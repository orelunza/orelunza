/**
 *
 * @file test_identity_service.cpp
 * @author Softadastra
 * @brief Tests for the Orelunza identity application service.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <identity/auth/AuthProvider.hpp>
#include <identity/domain/Account.hpp>
#include <identity/domain/AuthSession.hpp>
#include <identity/domain/Human.hpp>
#include <identity/domain/Persona.hpp>
#include <identity/errors/IdentityError.hpp>
#include <identity/repositories/IdentityRepository.hpp>
#include <identity/services/IdentityService.hpp>

#include <vix/tests/tests.hpp>

#include <optional>
#include <string>
#include <string_view>
#include <utility>

namespace
{
  namespace auth = orelunza::identity::auth;
  namespace domain = orelunza::identity::domain;
  namespace errors = orelunza::identity::errors;
  namespace repositories = orelunza::identity::repositories;
  namespace services = orelunza::identity::services;

  [[nodiscard]] domain::Account make_account()
  {
    return domain::Account{
        domain::AccountId{std::string{"account_001"}},
        "citizen@orelunza.test",
        true,
        true,
        100,
        100};
  }

  [[nodiscard]] domain::AuthSession make_session()
  {
    return domain::AuthSession{
        domain::AuthSessionId{std::string{"session_001"}},
        domain::AccountId{std::string{"account_001"}},
        100,
        1000,
        100,
        false};
  }

  [[nodiscard]] domain::Human make_human()
  {
    return domain::Human{
        domain::HumanId{std::string{"human_001"}},
        domain::AccountId{std::string{"account_001"}},
        100,
        100};
  }

  [[nodiscard]] domain::Persona make_persona()
  {
    return domain::Persona{
        domain::PersonaId{std::string{"persona_001"}},
        domain::HumanId{std::string{"human_001"}},
        "River Walker",
        "avatars/river-walker.png",
        100,
        100};
  }

  class FakeAuthProvider final : public auth::AuthProvider
  {
  public:
    auth::AuthProviderResult<domain::Account>
    register_account(
        const auth::RegisterCredentials &credentials) override
    {
      last_registered_email = credentials.email;
      last_registered_password = credentials.password;

      if (register_error.has_error())
      {
        return auth::AuthProviderResult<domain::Account>::failure(
            register_error);
      }

      return auth::AuthProviderResult<domain::Account>::success(
          account);
    }

    auth::AuthProviderResult<auth::ProviderLoginResult>
    login(
        const auth::LoginCredentials &credentials) override
    {
      last_login_email = credentials.email;
      last_login_password = credentials.password;

      if (login_error.has_error())
      {
        return auth::AuthProviderResult<
            auth::ProviderLoginResult>::failure(login_error);
      }

      return auth::AuthProviderResult<
          auth::ProviderLoginResult>::success(auth::ProviderLoginResult{
          account,
          session});
    }

    auth::AuthProviderResult<domain::AuthSession>
    authenticate(std::string_view session_id) override
    {
      last_authenticated_session = std::string(session_id);

      if (authenticate_error.has_error())
      {
        return auth::AuthProviderResult<
            domain::AuthSession>::failure(authenticate_error);
      }

      return auth::AuthProviderResult<
          domain::AuthSession>::success(session);
    }

    auth::AuthProviderStatus
    logout(std::string_view session_id) override
    {
      last_logout_session = std::string(session_id);

      if (logout_error.has_error())
      {
        return auth::AuthProviderStatus::failure(
            logout_error);
      }

      return auth::AuthProviderStatus::success();
    }

    domain::Account account = make_account();
    domain::AuthSession session = make_session();

    errors::IdentityError register_error;
    errors::IdentityError login_error;
    errors::IdentityError authenticate_error;
    errors::IdentityError logout_error;

    std::string last_registered_email;
    std::string last_registered_password;

    std::string last_login_email;
    std::string last_login_password;

    std::string last_authenticated_session;
    std::string last_logout_session;
  };

  class FakeIdentityRepository final
      : public repositories::IdentityRepository
  {
  public:
    repositories::RepositoryStatus
    create_human(const domain::Human &human) override
    {
      if (create_human_error.has_error())
      {
        return repositories::RepositoryStatus::failure(
            create_human_error);
      }

      stored_human = human;
      return repositories::RepositoryStatus::success();
    }

    repositories::RepositoryStatus
    update_human(const domain::Human &human) override
    {
      if (!stored_human.has_value())
      {
        return repositories::RepositoryStatus::failure(
            errors::make_identity_error(
                errors::IdentityErrorCode::HumanNotFound,
                "Human identity was not found."));
      }

      stored_human = human;
      return repositories::RepositoryStatus::success();
    }

    repositories::RepositoryResult<
        std::optional<domain::Human>>
    find_human_by_id(
        const domain::HumanId &id) const override
    {
      if (stored_human.has_value() &&
          stored_human->id() == id)
      {
        return repositories::RepositoryResult<
            std::optional<domain::Human>>::success(stored_human);
      }

      return repositories::RepositoryResult<
          std::optional<domain::Human>>::success(std::nullopt);
    }

    repositories::RepositoryResult<
        std::optional<domain::Human>>
    find_human_by_account_id(
        const domain::AccountId &account_id) const override
    {
      if (find_human_error.has_error())
      {
        return repositories::RepositoryResult<
            std::optional<domain::Human>>::failure(find_human_error);
      }

      if (stored_human.has_value() &&
          stored_human->account_id() == account_id)
      {
        return repositories::RepositoryResult<
            std::optional<domain::Human>>::success(stored_human);
      }

      return repositories::RepositoryResult<
          std::optional<domain::Human>>::success(std::nullopt);
    }

    repositories::RepositoryStatus
    create_persona(const domain::Persona &persona) override
    {
      if (create_persona_error.has_error())
      {
        return repositories::RepositoryStatus::failure(
            create_persona_error);
      }

      stored_persona = persona;
      return repositories::RepositoryStatus::success();
    }

    repositories::RepositoryStatus
    update_persona(const domain::Persona &persona) override
    {
      if (!stored_persona.has_value())
      {
        return repositories::RepositoryStatus::failure(
            errors::make_identity_error(
                errors::IdentityErrorCode::PersonaNotFound,
                "Persona was not found."));
      }

      stored_persona = persona;
      return repositories::RepositoryStatus::success();
    }

    repositories::RepositoryResult<
        std::optional<domain::Persona>>
    find_persona_by_id(
        const domain::PersonaId &id) const override
    {
      if (stored_persona.has_value() &&
          stored_persona->id() == id)
      {
        return repositories::RepositoryResult<
            std::optional<domain::Persona>>::success(stored_persona);
      }

      return repositories::RepositoryResult<
          std::optional<domain::Persona>>::success(std::nullopt);
    }

    repositories::RepositoryResult<
        std::optional<domain::Persona>>
    find_persona_by_human_id(
        const domain::HumanId &human_id) const override
    {
      if (find_persona_error.has_error())
      {
        return repositories::RepositoryResult<
            std::optional<domain::Persona>>::failure(find_persona_error);
      }

      if (stored_persona.has_value() &&
          stored_persona->human_id() == human_id)
      {
        return repositories::RepositoryResult<
            std::optional<domain::Persona>>::success(stored_persona);
      }

      return repositories::RepositoryResult<
          std::optional<domain::Persona>>::success(std::nullopt);
    }

    std::optional<domain::Human> stored_human;
    std::optional<domain::Persona> stored_persona;

    errors::IdentityError create_human_error;
    errors::IdentityError create_persona_error;
    errors::IdentityError find_human_error;
    errors::IdentityError find_persona_error;
  };
} // namespace

int main()
{
  using namespace vix::tests;

  auto &registry = TestRegistry::instance();
  registry.clear();

  registry.add(TestCase(
      "identity service registers a complete identity",
      []
      {
        FakeAuthProvider provider;
        FakeIdentityRepository repository;

        services::IdentityService service{
            provider,
            repository};

        const services::RegisterIdentityRequest request{
            "citizen@orelunza.test",
            "correct-password",
            "River Walker",
            "avatars/river-walker.png"};

        auto result = service.register_identity(request);

        Assert::is_true(result.ok());

        Assert::equal(
            std::string{"account_001"},
            result.value().account.id().value());

        Assert::equal(
            std::string{"session_001"},
            result.value().session.id().value());

        Assert::equal(
            std::string{"River Walker"},
            result.value().persona.display_name());

        Assert::equal(
            result.value().human.id().value(),
            result.value().persona.human_id().value());

        Assert::equal(
            result.value().account.id().value(),
            result.value().human.account_id().value());

        Assert::is_true(
            result.value().human.id().value().rfind(
                "human_",
                0) == 0);

        Assert::is_true(
            result.value().persona.id().value().rfind(
                "persona_",
                0) == 0);

        Assert::equal(
            request.email,
            provider.last_registered_email);

        Assert::equal(
            request.password,
            provider.last_registered_password);

        Assert::equal(
            request.email,
            provider.last_login_email);

        Assert::equal(
            request.password,
            provider.last_login_password);

        Assert::is_true(repository.stored_human.has_value());
        Assert::is_true(repository.stored_persona.has_value());
      }));

  registry.add(TestCase(
      "identity service rejects an empty display name",
      []
      {
        FakeAuthProvider provider;
        FakeIdentityRepository repository;

        services::IdentityService service{
            provider,
            repository};

        auto result = service.register_identity({"citizen@orelunza.test",
                                                 "correct-password",
                                                 "",
                                                 ""});

        Assert::is_true(result.failed());

        Assert::is_true(
            result.error().is(
                errors::IdentityErrorCode::InvalidInput));

        Assert::is_false(
            repository.stored_human.has_value());

        Assert::is_false(
            repository.stored_persona.has_value());
      }));

  registry.add(TestCase(
      "identity service propagates registration errors",
      []
      {
        FakeAuthProvider provider;
        FakeIdentityRepository repository;

        provider.register_error =
            errors::make_identity_error(
                errors::IdentityErrorCode::
                    AccountAlreadyExists,
                "Account already exists.");

        services::IdentityService service{
            provider,
            repository};

        auto result = service.register_identity({"citizen@orelunza.test",
                                                 "correct-password",
                                                 "River Walker",
                                                 ""});

        Assert::is_true(result.failed());

        Assert::is_true(
            result.error().is(
                errors::IdentityErrorCode::
                    AccountAlreadyExists));
      }));

  registry.add(TestCase(
      "identity service logs in and resolves identity",
      []
      {
        FakeAuthProvider provider;
        FakeIdentityRepository repository;

        repository.stored_human = make_human();
        repository.stored_persona = make_persona();

        services::IdentityService service{
            provider,
            repository};

        const services::LoginIdentityRequest request{
            "citizen@orelunza.test",
            "correct-password"};

        auto result = service.login(request);

        Assert::is_true(result.ok());

        Assert::equal(
            std::string{"account_001"},
            result.value().account.id().value());

        Assert::equal(
            std::string{"session_001"},
            result.value().session.id().value());

        Assert::equal(
            std::string{"human_001"},
            result.value().human.id().value());

        Assert::equal(
            std::string{"persona_001"},
            result.value().persona.id().value());

        Assert::equal(
            request.email,
            provider.last_login_email);

        Assert::equal(
            request.password,
            provider.last_login_password);
      }));

  registry.add(TestCase(
      "identity service reports a missing human after login",
      []
      {
        FakeAuthProvider provider;
        FakeIdentityRepository repository;

        services::IdentityService service{
            provider,
            repository};

        auto result = service.login({"citizen@orelunza.test",
                                     "correct-password"});

        Assert::is_true(result.failed());

        Assert::is_true(
            result.error().is(
                errors::IdentityErrorCode::HumanNotFound));
      }));

  registry.add(TestCase(
      "identity service authenticates the current identity",
      []
      {
        FakeAuthProvider provider;
        FakeIdentityRepository repository;

        repository.stored_human = make_human();
        repository.stored_persona = make_persona();

        services::IdentityService service{
            provider,
            repository};

        auto result =
            service.authenticate("session_001");

        Assert::is_true(result.ok());

        Assert::equal(
            std::string{"session_001"},
            result.value().session.id().value());

        Assert::equal(
            std::string{"human_001"},
            result.value().human.id().value());

        Assert::equal(
            std::string{"persona_001"},
            result.value().persona.id().value());

        Assert::equal(
            std::string{"session_001"},
            provider.last_authenticated_session);
      }));

  registry.add(TestCase(
      "identity service rejects an empty session",
      []
      {
        FakeAuthProvider provider;
        FakeIdentityRepository repository;

        services::IdentityService service{
            provider,
            repository};

        auto result = service.authenticate("");

        Assert::is_true(result.failed());

        Assert::is_true(
            result.error().is(
                errors::IdentityErrorCode::InvalidInput));
      }));

  registry.add(TestCase(
      "identity service logs out a session",
      []
      {
        FakeAuthProvider provider;
        FakeIdentityRepository repository;

        services::IdentityService service{
            provider,
            repository};

        auto status = service.logout("session_001");

        Assert::is_true(status.ok());

        Assert::equal(
            std::string{"session_001"},
            provider.last_logout_session);
      }));

  registry.add(TestCase(
      "identity service propagates logout errors",
      []
      {
        FakeAuthProvider provider;
        FakeIdentityRepository repository;

        provider.logout_error =
            errors::make_identity_error(
                errors::IdentityErrorCode::SessionRevoked,
                "Session is already revoked.");

        services::IdentityService service{
            provider,
            repository};

        auto status = service.logout("session_001");

        Assert::is_true(status.failed());

        Assert::is_true(
            status.error().is(
                errors::IdentityErrorCode::SessionRevoked));
      }));

  return TestRunner::run_all_and_exit();
}
