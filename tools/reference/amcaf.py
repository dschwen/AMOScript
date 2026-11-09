#!/usr/bin/env python3
"""AMCAF V1.50beta4 reverse-engineering entry point; shares the AMOS binary decoder."""
import sys
sys.dont_write_bytecode = True
from turbo_plus import main

if __name__ == '__main__':
    main('amcaf')
