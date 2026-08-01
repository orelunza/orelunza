/**
 *
 * @file test_world.cpp
 * @author Softadastra
 * @brief Basic tests for the Orelunza world module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <world/WorldModule.hpp>

#include <vix/tests/tests.hpp>

#include <string>

int main()
{
  using namespace vix::tests;

  auto &registry = TestRegistry::instance();
  registry.clear();

  registry.add(TestCase(
      "world module exposes its name",
      []
      {
        Assert::equal(
            std::string{
                orelunza::world::WorldModule::name()},
            std::string{"world"});
      }));

  registry.add(TestCase(
      "world module starts uninitialized",
      []
      {
        orelunza::world::WorldModule::shutdown();

        Assert::is_false(
            orelunza::world::WorldModule::initialized());
      }));

  registry.add(TestCase(
      "world module shutdown is idempotent",
      []
      {
        orelunza::world::WorldModule::shutdown();
        orelunza::world::WorldModule::shutdown();

        Assert::is_false(
            orelunza::world::WorldModule::initialized());
      }));

  return TestRunner::run_all_and_exit();
}
