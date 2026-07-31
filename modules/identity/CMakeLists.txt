cmake_minimum_required(VERSION 3.16)

file(GLOB_RECURSE orelunza_identity_SOURCES CONFIGURE_DEPENDS
  "${CMAKE_CURRENT_LIST_DIR}/src/*.cpp"
)

add_library(orelunza_identity
  ${orelunza_identity_SOURCES}
)

add_library(orelunza::identity ALIAS orelunza_identity)

target_include_directories(orelunza_identity
  PUBLIC
    "${CMAKE_CURRENT_LIST_DIR}/include"
  PRIVATE
    "${CMAKE_CURRENT_LIST_DIR}/src"
)

target_compile_features(orelunza_identity
  PUBLIC
    cxx_std_20
)

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

set_target_properties(orelunza_identity PROPERTIES
  OUTPUT_NAME "orelunza_identity"
)

if(DEFINED orelunza_BUILD_TESTS AND orelunza_BUILD_TESTS)
  function(orelunza_identity_add_test target_name test_name source_file)
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
        orelunza_identity
        vix::tests
    )

    add_test(
      NAME ${test_name}
      COMMAND ${target_name}
    )
  endfunction()

  orelunza_identity_add_test(
    orelunza_identity_tests
    orelunza.identity
    test_identity.cpp
  )

  orelunza_identity_add_test(
    orelunza_identity_rix_auth_provider_tests
    orelunza.identity.rix_auth_provider
    test_rix_auth_provider.cpp
  )

  orelunza_identity_add_test(
    orelunza_identity_repository_tests
    orelunza.identity.repository
    test_identity_repository.cpp
  )

  orelunza_identity_add_test(
    orelunza_identity_service_tests
    orelunza.identity.service
    test_identity_service.cpp
  )
endif()
