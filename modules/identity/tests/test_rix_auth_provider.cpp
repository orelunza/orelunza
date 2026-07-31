/**
 *
 * @file test_rix_auth_provider.cpp
 * @author Softadastra
 * @brief Tests for the Rix authentication provider adapter.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <identity/auth/RixAuthProvider.hpp>
#include <identity/errors/IdentityError.hpp>

#include <rix/auth/Auth.hpp>
#include <rix/auth/stores/MemorySessionStore.hpp>
#include <rix/auth/stores/MemoryUserStore.hpp>

#include <vix/tests/tests.hpp>

#include <string>

int main()
{
  using namespace vix::tests;

  namespace identity_auth = orelunza::identity::auth;
  namespace identity_errors = orelunza::identity::errors;
  namespace rix_auth = rixlib::auth;

  auto &registry = TestRegistry::instance();
  registry.clear();

  registry.add(TestCase(
      "rix auth provider registers an account",
      []
      {
        rix_auth::MemoryUserStore users;
        rix_auth::MemorySessionStore sessions;
        rix_auth::Auth auth{users, sessions};

        identity_auth::RixAuthProvider provider{auth};

        const identity_auth::RegisterCredentials credentials{
            "Citizen@Orelunza.test",
            "correct-password"};

        auto result = provider.register_account(credentials);

        Assert::is_true(result.ok());
        Assert::is_true(result.value().valid());

        Assert::equal(
            std::string{"citizen@orelunza.test"},
            result.value().email());

        Assert::is_true(result.value().active());
        Assert::is_true(result.value().email_verified());

        Assert::is_false(result.value().id().empty());
      }));

  registry.add(TestCase(
      "rix auth provider maps duplicate accounts",
      []
      {
        rix_auth::MemoryUserStore users;
        rix_auth::MemorySessionStore sessions;
        rix_auth::Auth auth{users, sessions};

        identity_auth::RixAuthProvider provider{auth};

        const identity_auth::RegisterCredentials first{
            "citizen@orelunza.test",
            "correct-password"};

        const identity_auth::RegisterCredentials duplicate{
            " CITIZEN@ORELUNZA.TEST ",
            "another-password"};

        auto created = provider.register_account(first);
        auto rejected = provider.register_account(duplicate);

        Assert::is_true(created.ok());
        Assert::is_true(rejected.failed());

        Assert::is_true(
            rejected.error().is(
                identity_errors::IdentityErrorCode::
                    AccountAlreadyExists));
      }));

  registry.add(TestCase(
      "rix auth provider logs in an account",
      []
      {
        rix_auth::MemoryUserStore users;
        rix_auth::MemorySessionStore sessions;
        rix_auth::Auth auth{users, sessions};

        identity_auth::RixAuthProvider provider{auth};

        const identity_auth::RegisterCredentials registration{
            "citizen@orelunza.test",
            "correct-password"};

        auto registered =
            provider.register_account(registration);

        Assert::is_true(registered.ok());

        const identity_auth::LoginCredentials credentials{
            "CITIZEN@ORELUNZA.TEST",
            "correct-password"};

        auto result = provider.login(credentials);

        Assert::is_true(result.ok());
        Assert::is_true(result.value().account.valid());
        Assert::is_true(result.value().session.valid());

        Assert::equal(
            registered.value().id().value(),
            result.value().account.id().value());

        Assert::equal(
            result.value().account.id().value(),
            result.value().session.account_id().value());

        Assert::is_false(
            result.value().session.id().empty());

        Assert::is_false(
            result.value().session.revoked());
      }));

  registry.add(TestCase(
      "rix auth provider maps invalid credentials",
      []
      {
        rix_auth::MemoryUserStore users;
        rix_auth::MemorySessionStore sessions;
        rix_auth::Auth auth{users, sessions};

        identity_auth::RixAuthProvider provider{auth};

        const identity_auth::RegisterCredentials registration{
            "citizen@orelunza.test",
            "correct-password"};

        auto registered =
            provider.register_account(registration);

        Assert::is_true(registered.ok());

        const identity_auth::LoginCredentials credentials{
            "citizen@orelunza.test",
            "wrong-password"};

        auto result = provider.login(credentials);

        Assert::is_true(result.failed());

        Assert::is_true(
            result.error().is(
                identity_errors::IdentityErrorCode::
                    InvalidCredentials));
      }));

  registry.add(TestCase(
      "rix auth provider authenticates a session",
      []
      {
        rix_auth::MemoryUserStore users;
        rix_auth::MemorySessionStore sessions;
        rix_auth::Auth auth{users, sessions};

        identity_auth::RixAuthProvider provider{auth};

        auto registered = provider.register_account({"citizen@orelunza.test",
                                                     "correct-password"});

        Assert::is_true(registered.ok());

        auto logged_in = provider.login({"citizen@orelunza.test",
                                         "correct-password"});

        Assert::is_true(logged_in.ok());

        const std::string session_id =
            logged_in.value().session.id().value();

        auto authenticated =
            provider.authenticate(session_id);

        Assert::is_true(authenticated.ok());

        Assert::equal(
            session_id,
            authenticated.value().id().value());

        Assert::equal(
            logged_in.value().account.id().value(),
            authenticated.value().account_id().value());
      }));

  registry.add(TestCase(
      "rix auth provider revokes a session",
      []
      {
        rix_auth::MemoryUserStore users;
        rix_auth::MemorySessionStore sessions;
        rix_auth::Auth auth{users, sessions};

        identity_auth::RixAuthProvider provider{auth};

        auto registered = provider.register_account({"citizen@orelunza.test",
                                                     "correct-password"});

        Assert::is_true(registered.ok());

        auto logged_in = provider.login({"citizen@orelunza.test",
                                         "correct-password"});

        Assert::is_true(logged_in.ok());

        const std::string session_id =
            logged_in.value().session.id().value();

        auto logout = provider.logout(session_id);

        Assert::is_true(logout.ok());

        auto authenticated =
            provider.authenticate(session_id);

        Assert::is_true(authenticated.failed());

        Assert::is_true(
            authenticated.error().is(
                identity_errors::IdentityErrorCode::
                    SessionRevoked));
      }));

  return TestRunner::run_all_and_exit();
}
