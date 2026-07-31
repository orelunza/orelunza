cmake_minimum_required(VERSION 3.16)

file(GLOB_RECURSE orelunza_world_SOURCES CONFIGURE_DEPENDS
  ${CMAKE_CURRENT_LIST_DIR}/src/*.cpp
)

add_library(orelunza_world ${orelunza_world_SOURCES})
add_library(orelunza::world ALIAS orelunza_world)

target_include_directories(orelunza_world
  PUBLIC
    ${CMAKE_CURRENT_LIST_DIR}/include
  PRIVATE
    ${CMAKE_CURRENT_LIST_DIR}/src
)

target_compile_features(orelunza_world PUBLIC cxx_std_20)

target_link_libraries(orelunza_world
  PUBLIC
    vix::vix
)

if(DEFINED VIX_MODULE_world_LINKS)
  target_link_libraries(orelunza_world
    PUBLIC
      ${VIX_MODULE_world_LINKS}
  )
endif()

if(DEFINED orelunza_BUILD_TESTS AND orelunza_BUILD_TESTS)
  file(GLOB_RECURSE orelunza_world_TEST_SOURCES CONFIGURE_DEPENDS
    ${CMAKE_CURRENT_LIST_DIR}/tests/*.cpp
  )

  if(orelunza_world_TEST_SOURCES)
    add_executable(orelunza_world_tests
      ${orelunza_world_TEST_SOURCES}
    )

    target_include_directories(orelunza_world_tests PRIVATE
      ${CMAKE_CURRENT_LIST_DIR}/include
      ${CMAKE_CURRENT_LIST_DIR}/src
    )

    target_link_libraries(orelunza_world_tests PRIVATE
      orelunza_world
      vix::vix
    )

    target_compile_features(orelunza_world_tests PRIVATE cxx_std_20)

    add_test(NAME orelunza.world COMMAND orelunza_world_tests)
  endif()
endif()

set_target_properties(orelunza_world PROPERTIES
  OUTPUT_NAME "orelunza_world"
)
