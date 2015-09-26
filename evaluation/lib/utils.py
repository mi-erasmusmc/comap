import logging, logging.config
from collections import OrderedDict
import yaml
import redo

if redo.running():
    logging.config.fileConfig(str(redo.path / 'lib' / 'logging.config'))

# Logging
    
def get_logger(name):
    return logging.getLogger(name)

logger = get_logger(__name__)

# YAML

def construct_OrderedDict(loader, node):
    loader.flatten_mapping(node)
    return OrderedDict(loader.construct_pairs(node))
yaml.loader.Loader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, construct_OrderedDict)


def represent_OrderedDict(dumper, data):
    return dumper.represent_dict(list(data.items()))
yaml.add_representer(OrderedDict, represent_OrderedDict, yaml.dumper.Dumper)
