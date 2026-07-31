/**
 * @file test_identity.cpp
 * @brief Basic tests for the identity backend module.
 */

#include <identity/IdentityModule.hpp>

#include <vix/tests/tests.hpp>

int main()
{
  using namespace vix::tests;

  auto &registry = TestRegistry::instance();
  registry.clear();

  registry.add(TestCase("identity module exposes its name", []
  {
    Assert::equal(
        std::string(orelunza::identity::IdentityModule::name()),
        std::string("identity"));
  }));

  return TestRunner::run_all_and_exit();
}
