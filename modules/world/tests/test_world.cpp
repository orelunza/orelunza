/**
 * @file test_world.cpp
 * @brief Basic tests for the world backend module.
 */

#include <world/WorldModule.hpp>

#include <vix/tests/tests.hpp>

int main()
{
  using namespace vix::tests;

  auto &registry = TestRegistry::instance();
  registry.clear();

  registry.add(TestCase("world module exposes its name", []
  {
    Assert::equal(
        std::string(orelunza::world::WorldModule::name()),
        std::string("world"));
  }));

  return TestRunner::run_all_and_exit();
}
