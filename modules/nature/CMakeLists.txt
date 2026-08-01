cmake_minimum_required(VERSION 3.16)

file(GLOB_RECURSE orelunza_nature_SOURCES CONFIGURE_DEPENDS
  "${CMAKE_CURRENT_LIST_DIR}/src/*.cpp"
)

add_library(orelunza_nature
  ${orelunza_nature_SOURCES}
)

add_library(orelunza::nature ALIAS orelunza_nature)

target_include_directories(orelunza_nature
  PUBLIC
    "${CMAKE_CURRENT_LIST_DIR}/include"
  PRIVATE
    "${CMAKE_CURRENT_LIST_DIR}/src"
)

target_compile_features(orelunza_nature
  PUBLIC
    cxx_std_20
)

target_link_libraries(orelunza_nature
  PUBLIC
    vix::vix
    orelunza::world
)

if(DEFINED VIX_MODULE_nature_LINKS)
  target_link_libraries(orelunza_nature
    PUBLIC
      ${VIX_MODULE_nature_LINKS}
  )
endif()

set_target_properties(orelunza_nature PROPERTIES
  OUTPUT_NAME "orelunza_nature"
)

if(DEFINED orelunza_BUILD_TESTS AND orelunza_BUILD_TESTS)
  function(
    orelunza_nature_add_test
    target_name
    test_name
    source_file
  )
    add_executable(${target_name}
      "${CMAKE_CURRENT_LIST_DIR}/tests/${source_file}"
    )

    target_include_directories(${target_name}
      PRIVATE
        "${CMAKE_CURRENT_LIST_DIR}/include"
        "${CMAKE_CURRENT_LIST_DIR}/src"
    )

    target_compile_features(${target_name}
      PRIVATE
        cxx_std_20
    )

    target_link_libraries(${target_name}
      PRIVATE
        orelunza::nature
        orelunza::world
        vix::tests
    )

    add_test(
      NAME ${test_name}
      COMMAND ${target_name}
    )
  endfunction()

  orelunza_nature_add_test(
    orelunza_nature_tests
    orelunza.nature
    test_nature.cpp
  )

  orelunza_nature_add_test(
    orelunza_nature_repository_tests
    orelunza.nature.repository
    test_nature_repository.cpp
  )

  orelunza_nature_add_test(
    orelunza_nature_service_tests
    orelunza.nature.service
    test_nature_service.cpp
  )
endif()
