cmake_minimum_required(VERSION 3.16)

file(GLOB_RECURSE orelunza_world_SOURCES CONFIGURE_DEPENDS
  "${CMAKE_CURRENT_LIST_DIR}/src/*.cpp"
)

add_library(orelunza_world
  ${orelunza_world_SOURCES}
)

add_library(orelunza::world ALIAS orelunza_world)

target_include_directories(orelunza_world
  PUBLIC
    "${CMAKE_CURRENT_LIST_DIR}/include"
  PRIVATE
    "${CMAKE_CURRENT_LIST_DIR}/src"
)

target_compile_features(orelunza_world
  PUBLIC
    cxx_std_20
)

target_link_libraries(orelunza_world
  PUBLIC
    vix::vix
    orelunza::identity
)

if(DEFINED VIX_MODULE_world_LINKS)
  target_link_libraries(orelunza_world
    PUBLIC
      ${VIX_MODULE_world_LINKS}
  )
endif()

set_target_properties(orelunza_world PROPERTIES
  OUTPUT_NAME "orelunza_world"
)

if(DEFINED orelunza_BUILD_TESTS AND orelunza_BUILD_TESTS)
  function(orelunza_world_add_test target_name test_name source_file)
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
        orelunza_world
        vix::tests
    )

    add_test(
      NAME ${test_name}
      COMMAND ${target_name}
    )
  endfunction()

  orelunza_world_add_test(
    orelunza_world_tests
    orelunza.world
    test_world.cpp
  )

  orelunza_world_add_test(
    orelunza_world_repository_tests
    orelunza.world.repository
    test_world_repository.cpp
  )

  orelunza_world_add_test(
    orelunza_world_service_tests
    orelunza.world.service
    test_world_service.cpp
  )
endif()
