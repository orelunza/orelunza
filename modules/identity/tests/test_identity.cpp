/**
 *
 * @file test_identity.cpp
 * @author Softadastra
 * @brief Basic tests for the Orelunza identity module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <identity/IdentityModule.hpp>

#include <vix/tests/tests.hpp>

#include <string>

int main()
{
  using namespace vix::tests;

  auto &registry = TestRegistry::instance();
  registry.clear();

  registry.add(TestCase(
      "identity module exposes its name",
      []
      {
        Assert::equal(
            std::string{
                orelunza::identity::IdentityModule::name()},
            std::string{"identity"});
      }));

  registry.add(TestCase(
      "identity module starts uninitialized",
      []
      {
        orelunza::identity::IdentityModule::shutdown();

        Assert::is_false(
            orelunza::identity::IdentityModule::initialized());
      }));

  registry.add(TestCase(
      "identity module shutdown is idempotent",
      []
      {
        orelunza::identity::IdentityModule::shutdown();
        orelunza::identity::IdentityModule::shutdown();

        Assert::is_false(
            orelunza::identity::IdentityModule::initialized());
      }));

  return TestRunner::run_all_and_exit();
}
