##
## Vix Modules (app-first, opt-in)
##
## Contract (Go-like):
## - modules/<m>/include/<m>/...  (public headers)
## - modules/<m>/src/...          (private impl)
## - Each module exports <project>::<m> as an ALIAS target
## - Public headers must never include private sources (src/)
## - Cross-module usage must be explicit via target_link_libraries
## - vix.app projects load only VIX_ENABLED_MODULES
##

if(DEFINED VIX_MODULES_INCLUDED)
  return()
endif()
set(VIX_MODULES_INCLUDED ON)

set(VIX_MODULES_PROJECT_DIR "${CMAKE_CURRENT_LIST_DIR}/..")
set(VIX_MODULES_DIR "${VIX_MODULES_PROJECT_DIR}/modules")

##
## vix.app mode
##
## When VIX_ENABLED_MODULES is defined by the generated CMakeLists.txt,
## only those modules are loaded. A module folder can exist without
## being active.
##
if(DEFINED VIX_ENABLED_MODULES)
  foreach(_m ${VIX_ENABLED_MODULES})
    string(REPLACE "-" "_" _m_norm "${_m}")
    set(_m_path_var "VIX_MODULE_${_m_norm}_PATH")

    if(DEFINED ${_m_path_var})
      set(_m_path "${${_m_path_var}}")
      if(IS_ABSOLUTE "${_m_path}")
        set(_m_dir "${_m_path}")
      else()
        set(_m_dir "${VIX_MODULES_PROJECT_DIR}/${_m_path}")
      endif()
    else()
      set(_m_dir "${VIX_MODULES_DIR}/${_m_norm}")
    endif()

    if(NOT EXISTS "${_m_dir}")
      message(FATAL_ERROR "VIX_MODULE_NOT_FOUND module=${_m_norm} path=${_m_dir}")
    endif()

    if(NOT EXISTS "${_m_dir}/CMakeLists.txt")
      message(FATAL_ERROR "VIX_MODULE_CMAKELISTS_NOT_FOUND module=${_m_norm} path=${_m_dir}/CMakeLists.txt")
    endif()

    add_subdirectory("${_m_dir}" "${CMAKE_BINARY_DIR}/vix_modules/${_m_norm}")
  endforeach()
  return()
endif()

##
## Legacy CMake mode
##
## If VIX_ENABLED_MODULES is not defined, keep the old behavior for
## classic CMake projects: load every module folder under modules/*.
##
if(NOT EXISTS "${VIX_MODULES_DIR}")
  return()
endif()

file(GLOB VIX_MODULE_DIRS RELATIVE "${VIX_MODULES_DIR}" "${VIX_MODULES_DIR}/*")
foreach(_m ${VIX_MODULE_DIRS})
  if(IS_DIRECTORY "${VIX_MODULES_DIR}/${_m}")
    if(EXISTS "${VIX_MODULES_DIR}/${_m}/CMakeLists.txt")
      add_subdirectory("${VIX_MODULES_DIR}/${_m}" "${CMAKE_BINARY_DIR}/vix_modules/${_m}")
    endif()
  endif()
endforeach()
