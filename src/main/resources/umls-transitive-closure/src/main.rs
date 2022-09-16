use std::{
    collections::{HashMap, HashSet},
    fs::File,
    io::Write,
    path::{Path, PathBuf},
};

use clap::Parser;
use csv::WriterBuilder;
use petgraph::{
    adj::List,
    algo::{
        is_cyclic_directed, toposort,
        tred::{dag_to_toposorted_adjacency_list, dag_transitive_reduction_closure},
    },
    Graph,
};

const REL_PAR: &str = "PAR";
const REL_CHD: &str = "CHD";
const MRCONSO_AUI_COLUMN: usize = 7;
const MRCONSO_SAB_COLUMN: usize = 11;
const MRCONSO_CODE_COLUMN: usize = 13;
// const MRCONSO_SUPPRESS_COLUMN: usize = 16;
const MRREL_AUI1_COLUMN: usize = 1;
const MRREL_REL_COLUMN: usize = 3;
const MRREL_AUI2_COLUMN: usize = 5;

/// Create transitive closure table from UMLS RFF files
#[derive(Parser)]
struct Args {
    /// MRCONSO.RFF
    #[clap(long)]
    mrconso: PathBuf,
    /// MRREL.RFF
    #[clap(long)]
    mrrel: PathBuf,
    /// Comma-separated list of vocabularies to consider (all by default)
    #[clap(long)]
    sabs: Option<String>,
    /// Write AUIs not codes
    #[clap(long)]
    write_auis: bool,
    /// Output file
    #[clap(long)]
    output: PathBuf,
}

fn get_reader(path: &Path) -> csv::Reader<File> {
    csv::ReaderBuilder::new()
        .has_headers(false)
        .delimiter(b'|')
        .quote(0)
        .from_path(path)
        .expect("cannot read input file")
}

fn read_mrconso(
    mut reader: csv::Reader<File>,
    sabs: &HashSet<String>,
) -> HashMap<String, HashMap<String, HashSet<String>>> {
    let mut stdout = std::io::stdout();
    write!(stdout, "Reading MRCONSO ").unwrap();
    stdout.flush().unwrap();
    let mut res = HashMap::new();
    for record in reader.records() {
        let record = record.expect("error in record");
        if record.position().map(|i| i.line() % 1_000_000) == Some(0) {
            write!(stdout, ".").unwrap();
            stdout.flush().unwrap();
        }
        let sab = record.get(MRCONSO_SAB_COLUMN).unwrap();
        if !sabs.is_empty() && !sabs.contains(sab) {
            continue;
        }
        // let suppress = record.get(MRCONSO_SUPPRESS_COLUMN).unwrap();
        // if suppress == "Y" {
        //     continue;
        // }
        let aui = record.get(MRCONSO_AUI_COLUMN).unwrap();
        let code = record.get(MRCONSO_CODE_COLUMN).unwrap();
        res.entry(sab.to_owned())
            .or_insert_with(HashMap::new)
            .entry(code.to_owned())
            .or_insert_with(HashSet::new)
            .insert(aui.to_owned());
    }
    writeln!(stdout).unwrap();
    res
}

fn read_mrrel(
    mut reader: csv::Reader<File>,
    all_auis: &HashSet<&str>,
) -> HashMap<String, HashSet<String>> {
    let mut stdout = std::io::stdout();
    write!(stdout, "Reading MRREL ").unwrap();
    stdout.flush().unwrap();
    let mut res = HashMap::new();
    for record in reader.records() {
        let record = record.expect("error in record");
        if record.position().map(|i| i.line() % 1_000_000) == Some(0) {
            write!(stdout, ".").unwrap();
            stdout.flush().unwrap();
        }
        let aui1 = record.get(MRREL_AUI1_COLUMN).unwrap();
        let aui2 = record.get(MRREL_AUI2_COLUMN).unwrap();
        if !all_auis.contains(aui1) || !all_auis.contains(aui2) {
            continue;
        }
        let rel = record.get(MRREL_REL_COLUMN).unwrap();
        let (aui_sup, aui_sub) = match rel {
            REL_CHD => (aui1, aui2),
            REL_PAR => (aui2, aui1),
            _ => continue,
        };
        res.entry(aui_sup.to_string())
            .or_insert_with(HashSet::new)
            .insert(aui_sub.to_string());
    }
    writeln!(stdout).unwrap();
    res
}

fn make_graph<'a>(
    all_auis: &HashSet<&'a str>,
    mrrel: &HashMap<String, HashSet<String>>,
) -> Graph<&'a str, ()> {
    let mut graph = Graph::new();
    // {aui -> ix}
    let mut aui_ixs = HashMap::new();
    for &aui in all_auis.iter() {
        let ix = graph.add_node(aui);
        aui_ixs.insert(aui, ix);
    }
    for (aui1, auis2) in mrrel.iter() {
        if !all_auis.contains(aui1.as_str()) {
            continue;
        }
        for aui2 in auis2 {
            if !all_auis.contains(aui2.as_str()) {
                continue;
            }
            let node1 = *aui_ixs.get(aui1.as_str()).unwrap();
            let node2 = *aui_ixs.get(aui2.as_str()).unwrap();
            graph.add_edge(node1, node2, ());
        }
    }
    graph
}

fn write(
    writer: &mut csv::Writer<File>,
    sab: &str,
    graph: &Graph<&str, ()>,
    closure: &List<(), usize>,
    revtopo: &[usize],
    aui_codes: &HashMap<&str, &str>,
    write_auis: bool,
) {
    let mut revtoporev = vec![0; revtopo.len()];
    for ix in 0..revtopo.len() {
        revtoporev[revtopo[ix]] = ix;
    }

    // {code(sup) -> {code(sub)}}
    let mut res = HashMap::new();
    for ix in graph.node_indices() {
        let aui1 = *graph.node_weight(ix).unwrap();
        for edge_ix in closure.edge_indices_from(revtopo[ix.index()]) {
            let (_, ix2) = closure.edge_endpoints(edge_ix).unwrap();
            let aui2 = *graph
                .node_weight(petgraph::graph::NodeIndex::new(revtoporev[ix2]))
                .unwrap();
            if write_auis {
                res.entry(aui1).or_insert_with(HashSet::new).insert(aui2);
            } else {
                let code1 = *aui_codes.get(aui1).unwrap();
                let code2 = *aui_codes.get(aui2).unwrap();
                res.entry(code1).or_insert_with(HashSet::new).insert(code2);
            }
        }
    }
    for (code1, codes2) in res {
        for code2 in codes2 {
            if write_auis {
                writer.write_record([code1, code2])
            } else {
                writer.write_record([sab, code1, code2])
            }.expect("cannot write record");
        }
    }
}

fn main() {
    let args = Args::parse();
    let sabs = args
        .sabs
        .map(|s| s.split(',').map(ToOwned::to_owned).collect())
        .unwrap_or_else(HashSet::new);
    let mrconso_reader = get_reader(&args.mrconso);
    let mrrel_reader = get_reader(&args.mrrel);

    // {sab -> {code -> {aui}}}
    let mrconso = read_mrconso(mrconso_reader, &sabs);

    // {aui}
    let mut all_auis = HashSet::new();
    for codes in mrconso.values() {
        for auis in codes.values() {
            for aui in auis {
                all_auis.insert(aui.as_str());
            }
        }
    }

    // {aui(sup) -> {aui(sub)}}
    let mrrel = read_mrrel(mrrel_reader, &all_auis);

    let output = File::create(args.output).expect("cannot create output file");
    let mut writer = WriterBuilder::new()
        .has_headers(false)
        .delimiter(b'|')
        .quote(b'\'')
        .from_writer(output);

    for (sab, codes) in mrconso.iter() {
        println!(
            "Processing {sab} with {} codes, {} auis...",
            codes.len(),
            codes.values().map(HashSet::len).sum::<usize>()
        );

        // {aui}
        let mut all_auis = HashSet::new();

        // {aui -> code}
        let mut aui_codes = HashMap::new();

        for (code, auis) in codes.iter() {
            for aui in auis {
                all_auis.insert(aui.as_str());
                aui_codes.insert(aui.as_str(), code.as_str());
            }
        }

        let graph = make_graph(&all_auis, &mrrel);
        if is_cyclic_directed(&graph) {
            println!("- ignoring, it's cylic!");
            continue;
        }
        println!("- generate transitive closure");
        let toposort = toposort(&graph, None).expect("cyclic coding system");
        let (toposorted, revtopo) = dag_to_toposorted_adjacency_list(&graph, &toposort);
        let (_reduction, closure) = dag_transitive_reduction_closure::<(), usize>(&toposorted);

        println!("- writing");
        write(&mut writer, sab, &graph, &closure, &revtopo, &aui_codes, args.write_auis);
    }
}
