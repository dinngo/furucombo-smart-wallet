#!/bin/python
# usage: python scripts/parse_config.py 0x0100000000000000000203ffffffffffffffffffffffffffffffffffffffffff
import sys


def parse_static(config):
    if config[1] == "1":
        param_type = "dynamic delegateCall"
    elif config[1] == "2":
        param_type = "static call"
    elif config[1] == "3":
        param_type = "dynamic call"
    else:
        param_type = "static delegateCall"

    print("Param Type: \t\t\t" + param_type)


def parse_reference_count(config):
    print("Reference Count: \t\t" + str(int('0x'+config, 16)))


def parse_params(config):
    hex_int = int(config, 16)
    bit_params = bin(hex_int)[2:]
    idx = len(bit_params)-1
    params = []
    for b in bit_params:
        if b == '1':
            arg = {}
            arg['idx'] = idx
            params.append(arg)
        idx -= 1
    print("Param Config:" + "(" + config + ") " + ''.join(str(x)
          for x in params))
    return params


def parse_reference(config, params):
    print("========= reference config ===========")
    if len(params) == 0:
        return params

    config = config.replace("ff", "")
    idx = len(config)
    pidx = len(params)-1
    while idx > 0:
        reference_idx = config[idx-2: idx]
        hex_int = int(reference_idx, 16)
        params[pidx]['stack'] = hex_int
        idx -= 2
        pidx -= 1

    for param in params:
        print("replace params[%s] <- local stack[%d]" %
              (param['idx'], param['stack']))

    return params


if __name__ == "__main__":
    config = sys.argv[1]
    print("CONFIG:" + config)
    if len(config) != 66:
        raise Exception("wrong config format")
    static_config = config[2:4]
    reference_count_config = config[4:6]
    param_config = config[6:22]
    reference_config = config[22:]
    parse_static(static_config)
    parse_reference_count(reference_count_config)
    params = parse_params(param_config)
    params = parse_reference(reference_config, params)
