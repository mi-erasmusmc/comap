sed -i \
  -e 's/\\begin{table}/\\begin{figure}/' \
  -e 's/\\end{table}/\\end{figure}/' \
  "$2".tex
latex2rtf -F -M4 -f1 -o $3 "$2".tex
