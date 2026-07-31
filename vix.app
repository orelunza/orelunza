# Vix backend application manifest
# This file describes one executable backend target.
# Vix converts it to an internal CMake project under .vix/generated/app/.

name = "orelunza"
type = "executable"
standard = "c++20"
output_dir = "bin"

sources = [
  "src/main.cpp",
  "src/orelunza/app/AppBootstrap.cpp",
  "src/orelunza/support/HttpResponses.cpp",
  "src/orelunza/presentation/routes/RouteRegistry.cpp",
  "src/orelunza/presentation/middleware/MiddlewareRegistry.cpp",
  "src/orelunza/presentation/controllers/HomeController.cpp",
  "src/orelunza/presentation/controllers/HealthController.cpp",
]

include_dirs = [
  "include",
  "src",
]

defines = [
  "VIX_BACKEND_APP=1",
  "VIX_APP_NAME=orelunza",
]

compile_options = [
  "$<$<CXX_COMPILER_ID:MSVC>:/W4>",
  "$<$<CXX_COMPILER_ID:MSVC>:/permissive->",
  "$<$<NOT:$<CXX_COMPILER_ID:MSVC>>:-Wall>",
  "$<$<NOT:$<CXX_COMPILER_ID:MSVC>>:-Wextra>",
  "$<$<NOT:$<CXX_COMPILER_ID:MSVC>>:-Wpedantic>",
]

link_options = [
]

compile_features = [
  "cxx_std_20",
]

packages = [
  "vix",
]

links = [
  "vix::vix",
]

resources = [
  ".env=.env",
  "storage=storage",
]

[module.identity]
enabled = true
path = modules/identity
kind = service

[module.world]
enabled = true
path = modules/world
kind = service
