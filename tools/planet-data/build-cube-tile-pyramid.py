#!/usr/bin/env python3
"""Compatibility entry point for the Orelunza geography pack builder."""
from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).with_name('build-geography-pack.py')), run_name='__main__')
