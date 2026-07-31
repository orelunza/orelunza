/**
 *
 * @file test_identity_repository.cpp
 * @author Softadastra
 * @brief Tests for the database-backed Orelunza identity repository.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <identity/domain/Human.hpp>
#include <identity/domain/Persona.hpp>
#include <identity/errors/IdentityError.hpp>
#include <identity/repositories/DbIdentityRepository.hpp>

#include <vix/db/Database.hpp>
#include <vix/tests/tests.hpp>

#include <atomic>
#include <chrono>
#include <cstdint>
#include <filesystem>
#include <string>
#include <utility>

namespace
{
  namespace fs = std::filesystem;

  struct TemporaryDatabaseFile
  {
    fs::path path;

    TemporaryDatabaseFile()
        : path(make_path())
    {
      remove_files();
    }

    ~TemporaryDatabaseFile()
    {
      remove_files();
    }

    TemporaryDatabaseFile(
        const TemporaryDatabaseFile &) = delete;

    TemporaryDatabaseFile &operator=(
        const TemporaryDatabaseFile &) = delete;

  private:
    [[nodiscard]] static fs::path make_path()
    {
      static std::atomic<std::uint64_t> sequence{0};

      const auto timestamp =
          std::chrono::steady_clock::now()
              .time_since_epoch()
              .count();

      const auto number =
          sequence.fetch_add(1, std::memory_order_relaxed);

      return fs::temp_directory_path() /
             ("orelunza_identity_test_" +
              std::to_string(timestamp) +
              "_" +
              std::to_string(number) +
              ".db");
    }

    void remove_files() const noexcept
    {
      std::error_code error;

      fs::remove(path, error);
      fs::remove(path.string() + "-wal", error);
      fs::remove(path.string() + "-shm", error);
    }
  };

  [[nodiscard]]
  orelunza::identity::domain::Human make_human(
      std::string id = "human_001",
      std::string account_id = "account_001",
      std::int64_t created_at = 100)
  {
    namespace domain = orelunza::identity::domain;

    return domain::Human{
        domain::HumanId{std::move(id)},
        domain::AccountId{std::move(account_id)},
        created_at,
        created_at};
  }

  [[nodiscard]]
  orelunza::identity::domain::Persona make_persona(
      std::string id = "persona_001",
      std::string human_id = "human_001",
      std::string display_name = "River Walker",
      std::string avatar = "")
  {
    namespace domain = orelunza::identity::domain;

    return domain::Persona{
        domain::PersonaId{std::move(id)},
        domain::HumanId{std::move(human_id)},
        std::move(display_name),
        std::move(avatar),
        100,
        100};
  }
} // namespace

int main()
{
  using namespace vix::tests;

  namespace domain = orelunza::identity::domain;
  namespace errors = orelunza::identity::errors;
  namespace repositories =
      orelunza::identity::repositories;

  auto &registry = TestRegistry::instance();
  registry.clear();

  registry.add(TestCase(
      "identity repository initializes its schema",
      []
      {
        TemporaryDatabaseFile file;

        auto database =
            vix::db::Database::sqlite(file.path.string());

        repositories::DbIdentityRepository repository{
            database};

        Assert::is_true(repository.ready());
        Assert::is_true(
            repository.schema_status().ok());
      }));

  registry.add(TestCase(
      "identity repository creates and finds a human",
      []
      {
        TemporaryDatabaseFile file;

        auto database =
            vix::db::Database::sqlite(file.path.string());

        repositories::DbIdentityRepository repository{
            database};

        const auto human = make_human();

        auto created =
            repository.create_human(human);

        Assert::is_true(created.ok());

        auto by_id =
            repository.find_human_by_id(human.id());

        Assert::is_true(by_id.ok());
        Assert::is_true(by_id.value().has_value());

        Assert::equal(
            human.id().value(),
            by_id.value()->id().value());

        Assert::equal(
            human.account_id().value(),
            by_id.value()->account_id().value());

        auto by_account =
            repository.find_human_by_account_id(
                human.account_id());

        Assert::is_true(by_account.ok());
        Assert::is_true(
            by_account.value().has_value());

        Assert::equal(
            human.id().value(),
            by_account.value()->id().value());
      }));

  registry.add(TestCase(
      "identity repository rejects duplicate human ownership",
      []
      {
        TemporaryDatabaseFile file;

        auto database =
            vix::db::Database::sqlite(file.path.string());

        repositories::DbIdentityRepository repository{
            database};

        auto first = repository.create_human(
            make_human(
                "human_001",
                "account_001"));

        auto duplicate = repository.create_human(
            make_human(
                "human_002",
                "account_001"));

        Assert::is_true(first.ok());
        Assert::is_true(duplicate.failed());

        Assert::is_true(
            duplicate.error().is(
                errors::IdentityErrorCode::
                    AccountAlreadyExists));
      }));

  registry.add(TestCase(
      "identity repository updates a human",
      []
      {
        TemporaryDatabaseFile file;

        auto database =
            vix::db::Database::sqlite(file.path.string());

        repositories::DbIdentityRepository repository{
            database};

        auto human = make_human();

        Assert::is_true(
            repository.create_human(human).ok());

        human.set_updated_at(200);

        auto updated =
            repository.update_human(human);

        Assert::is_true(updated.ok());

        auto found =
            repository.find_human_by_id(human.id());

        Assert::is_true(found.ok());
        Assert::is_true(found.value().has_value());

        Assert::equal(
            static_cast<std::int64_t>(200),
            found.value()->updated_at());
      }));

  registry.add(TestCase(
      "identity repository creates and finds a persona",
      []
      {
        TemporaryDatabaseFile file;

        auto database =
            vix::db::Database::sqlite(file.path.string());

        repositories::DbIdentityRepository repository{
            database};

        const auto human = make_human();
        const auto persona = make_persona();

        Assert::is_true(
            repository.create_human(human).ok());

        auto created =
            repository.create_persona(persona);

        Assert::is_true(created.ok());

        auto by_id =
            repository.find_persona_by_id(
                persona.id());

        Assert::is_true(by_id.ok());
        Assert::is_true(by_id.value().has_value());

        Assert::equal(
            persona.id().value(),
            by_id.value()->id().value());

        Assert::equal(
            persona.display_name(),
            by_id.value()->display_name());

        auto by_human =
            repository.find_persona_by_human_id(
                persona.human_id());

        Assert::is_true(by_human.ok());
        Assert::is_true(
            by_human.value().has_value());

        Assert::equal(
            persona.id().value(),
            by_human.value()->id().value());
      }));

  registry.add(TestCase(
      "identity repository rejects duplicate persona ownership",
      []
      {
        TemporaryDatabaseFile file;

        auto database =
            vix::db::Database::sqlite(file.path.string());

        repositories::DbIdentityRepository repository{
            database};

        Assert::is_true(
            repository.create_human(
                          make_human())
                .ok());

        auto first = repository.create_persona(
            make_persona(
                "persona_001",
                "human_001",
                "River Walker"));

        auto duplicate = repository.create_persona(
            make_persona(
                "persona_002",
                "human_001",
                "Forest Reader"));

        Assert::is_true(first.ok());
        Assert::is_true(duplicate.failed());

        Assert::is_true(
            duplicate.error().is(
                errors::IdentityErrorCode::
                    InvalidInput));
      }));

  registry.add(TestCase(
      "identity repository updates a persona",
      []
      {
        TemporaryDatabaseFile file;

        auto database =
            vix::db::Database::sqlite(file.path.string());

        repositories::DbIdentityRepository repository{
            database};

        Assert::is_true(
            repository.create_human(
                          make_human())
                .ok());

        auto persona = make_persona();

        Assert::is_true(
            repository.create_persona(persona).ok());

        persona.set_display_name("Forest Reader");
        persona.set_avatar("avatars/forest-reader.png");
        persona.set_updated_at(200);

        auto updated =
            repository.update_persona(persona);

        Assert::is_true(updated.ok());

        auto found =
            repository.find_persona_by_id(
                persona.id());

        Assert::is_true(found.ok());
        Assert::is_true(found.value().has_value());

        Assert::equal(
            std::string{"Forest Reader"},
            found.value()->display_name());

        Assert::equal(
            std::string{"avatars/forest-reader.png"},
            found.value()->avatar());

        Assert::equal(
            static_cast<std::int64_t>(200),
            found.value()->updated_at());
      }));

  registry.add(TestCase(
      "identity repository returns empty results for unknown ids",
      []
      {
        TemporaryDatabaseFile file;

        auto database =
            vix::db::Database::sqlite(file.path.string());

        repositories::DbIdentityRepository repository{
            database};

        auto human =
            repository.find_human_by_id(
                domain::HumanId{
                    std::string{"human_unknown"}});

        auto persona =
            repository.find_persona_by_id(
                domain::PersonaId{
                    std::string{"persona_unknown"}});

        Assert::is_true(human.ok());
        Assert::is_false(
            human.value().has_value());

        Assert::is_true(persona.ok());
        Assert::is_false(
            persona.value().has_value());
      }));

  return TestRunner::run_all_and_exit();
}
