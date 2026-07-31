cmake_minimum_required(VERSION 3.16)

file(GLOB_RECURSE orelunza_identity_SOURCES CONFIGURE_DEPENDS
  ${CMAKE_CURRENT_LIST_DIR}/src/*.cpp
)

add_library(orelunza_identity ${orelunza_identity_SOURCES})
add_library(orelunza::identity ALIAS orelunza_identity)

target_include_directories(orelunza_identity
  PUBLIC
    ${CMAKE_CURRENT_LIST_DIR}/include
  PRIVATE
    ${CMAKE_CURRENT_LIST_DIR}/src
)

target_compile_features(orelunza_identity PUBLIC cxx_std_20)

target_link_libraries(orelunza_identity
  PUBLIC
    vix::vix
)

if(DEFINED VIX_MODULE_identity_LINKS)
  target_link_libraries(orelunza_identity
    PUBLIC
      ${VIX_MODULE_identity_LINKS}
  )
endif()

if(DEFINED orelunza_BUILD_TESTS AND orelunza_BUILD_TESTS)
  file(GLOB_RECURSE orelunza_identity_TEST_SOURCES CONFIGURE_DEPENDS
    ${CMAKE_CURRENT_LIST_DIR}/tests/*.cpp
  )

  if(orelunza_identity_TEST_SOURCES)
    add_executable(orelunza_identity_tests
      ${orelunza_identity_TEST_SOURCES}
    )

    target_include_directories(orelunza_identity_tests PRIVATE
      ${CMAKE_CURRENT_LIST_DIR}/include
      ${CMAKE_CURRENT_LIST_DIR}/src
    )

    target_link_libraries(orelunza_identity_tests PRIVATE
      orelunza_identity
      vix::vix
    )

    target_compile_features(orelunza_identity_tests PRIVATE cxx_std_20)

    add_test(NAME orelunza.identity COMMAND orelunza_identity_tests)
  endif()
endif()

set_target_properties(orelunza_identity PROPERTIES
  OUTPUT_NAME "orelunza_identity"
)
