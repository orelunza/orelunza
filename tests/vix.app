# Vix backend test manifest
#
# This file describes the generated test executable for the backend app.
# The test target is intentionally separate from the application target.
# Do not include ../src/main.cpp here because tests define their own main().

name = "orelunza_tests"
type = "executable"
standard = "c++20"
output_dir = "bin"

sources = [
  "test_basic.cpp",
]

include_dirs = [
  "../include",
  "../src",
]

defines = [
  "VIX_BACKEND_TESTS=1",
  "VIX_APP_NAME=orelunza",
]

packages = [
  "vix",
]

links = [
  "vix::vix",
]
