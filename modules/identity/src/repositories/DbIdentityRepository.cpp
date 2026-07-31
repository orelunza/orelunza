/**
 *
 * @file DbIdentityRepository.cpp
 * @author Softadastra
 * @brief Database identity repository implementation for Orelunza.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <identity/repositories/DbIdentityRepository.hpp>

#include <vix/db/Database.hpp>
#include <vix/db/core/Result.hpp>

#include <algorithm>
#include <cctype>
#include <exception>
#include <optional>
#include <string>
#include <utility>

namespace orelunza::identity::repositories
{
  DbIdentityRepository::DbIdentityRepository(
      vix::db::Database &database,
      bool create_schema)
      : database_(&database)
  {
    if (create_schema)
    {
      schema_status_ = ensure_schema();
    }
  }

  RepositoryStatus DbIdentityRepository::create_human(
      const domain::Human &human)
  {
    if (!human.valid())
    {
      return RepositoryStatus::failure(
          invalid_human_error());
    }

    if (auto status = require_ready(); status.failed())
    {
      return status;
    }

    try
    {
      database_->exec(
          "INSERT INTO identity_humans "
          "(id, account_id, created_at, updated_at) "
          "VALUES (?, ?, ?, ?)",
          human.id().value(),
          human.account_id().value(),
          human.created_at(),
          human.updated_at());

      return RepositoryStatus::success();
    }
    catch (const std::exception &error)
    {
      if (unique_constraint_error(error.what()))
      {
        return RepositoryStatus::failure(
            human_conflict_error());
      }

      return RepositoryStatus::failure(
          storage_error(error.what()));
    }
    catch (...)
    {
      return RepositoryStatus::failure(
          storage_error("Unknown database error."));
    }
  }

  RepositoryStatus DbIdentityRepository::update_human(
      const domain::Human &human)
  {
    if (!human.valid())
    {
      return RepositoryStatus::failure(
          invalid_human_error());
    }

    if (auto status = require_ready(); status.failed())
    {
      return status;
    }

    try
    {
      auto existing = find_human_by_id(human.id());

      if (existing.failed())
      {
        return RepositoryStatus::failure(
            existing.error());
      }

      if (!existing.value().has_value())
      {
        return RepositoryStatus::failure(
            human_not_found_error());
      }

      database_->exec(
          "UPDATE identity_humans "
          "SET account_id = ?, updated_at = ? "
          "WHERE id = ?",
          human.account_id().value(),
          human.updated_at(),
          human.id().value());

      return RepositoryStatus::success();
    }
    catch (const std::exception &error)
    {
      if (unique_constraint_error(error.what()))
      {
        return RepositoryStatus::failure(
            human_conflict_error());
      }

      return RepositoryStatus::failure(
          storage_error(error.what()));
    }
    catch (...)
    {
      return RepositoryStatus::failure(
          storage_error("Unknown database error."));
    }
  }

  RepositoryResult<std::optional<domain::Human>>
  DbIdentityRepository::find_human_by_id(
      const domain::HumanId &id) const
  {
    if (!id.valid())
    {
      return RepositoryResult<std::optional<domain::Human>>::failure(
          invalid_human_error());
    }

    if (auto status = require_ready(); status.failed())
    {
      return RepositoryResult<std::optional<domain::Human>>::failure(
          status.error());
    }

    try
    {
      auto result = database_->query(
          "SELECT id, account_id, created_at, updated_at "
          "FROM identity_humans "
          "WHERE id = ? "
          "LIMIT 1",
          id.value());

      if (!result->next())
      {
        return RepositoryResult<std::optional<domain::Human>>::success(
            std::nullopt);
      }

      return RepositoryResult<std::optional<domain::Human>>::success(
          human_from_row(result->row()));
    }
    catch (const std::exception &error)
    {
      return RepositoryResult<std::optional<domain::Human>>::failure(
          storage_error(error.what()));
    }
    catch (...)
    {
      return RepositoryResult<std::optional<domain::Human>>::failure(
          storage_error("Unknown database error."));
    }
  }

  RepositoryResult<std::optional<domain::Human>>
  DbIdentityRepository::find_human_by_account_id(
      const domain::AccountId &account_id) const
  {
    if (!account_id.valid())
    {
      return RepositoryResult<std::optional<domain::Human>>::failure(
          invalid_human_error());
    }

    if (auto status = require_ready(); status.failed())
    {
      return RepositoryResult<std::optional<domain::Human>>::failure(
          status.error());
    }

    try
    {
      auto result = database_->query(
          "SELECT id, account_id, created_at, updated_at "
          "FROM identity_humans "
          "WHERE account_id = ? "
          "LIMIT 1",
          account_id.value());

      if (!result->next())
      {
        return RepositoryResult<std::optional<domain::Human>>::success(
            std::nullopt);
      }

      return RepositoryResult<std::optional<domain::Human>>::success(
          human_from_row(result->row()));
    }
    catch (const std::exception &error)
    {
      return RepositoryResult<std::optional<domain::Human>>::failure(
          storage_error(error.what()));
    }
    catch (...)
    {
      return RepositoryResult<std::optional<domain::Human>>::failure(
          storage_error("Unknown database error."));
    }
  }

  RepositoryStatus DbIdentityRepository::create_persona(
      const domain::Persona &persona)
  {
    if (!persona.valid())
    {
      return RepositoryStatus::failure(
          invalid_persona_error());
    }

    if (auto status = require_ready(); status.failed())
    {
      return status;
    }

    try
    {
      database_->exec(
          "INSERT INTO identity_personas "
          "(id, human_id, display_name, avatar, created_at, updated_at) "
          "VALUES (?, ?, ?, ?, ?, ?)",
          persona.id().value(),
          persona.human_id().value(),
          persona.display_name(),
          persona.avatar(),
          persona.created_at(),
          persona.updated_at());

      return RepositoryStatus::success();
    }
    catch (const std::exception &error)
    {
      if (unique_constraint_error(error.what()))
      {
        return RepositoryStatus::failure(
            persona_conflict_error());
      }

      return RepositoryStatus::failure(
          storage_error(error.what()));
    }
    catch (...)
    {
      return RepositoryStatus::failure(
          storage_error("Unknown database error."));
    }
  }

  RepositoryStatus DbIdentityRepository::update_persona(
      const domain::Persona &persona)
  {
    if (!persona.valid())
    {
      return RepositoryStatus::failure(
          invalid_persona_error());
    }

    if (auto status = require_ready(); status.failed())
    {
      return status;
    }

    try
    {
      auto existing = find_persona_by_id(persona.id());

      if (existing.failed())
      {
        return RepositoryStatus::failure(
            existing.error());
      }

      if (!existing.value().has_value())
      {
        return RepositoryStatus::failure(
            persona_not_found_error());
      }

      database_->exec(
          "UPDATE identity_personas "
          "SET human_id = ?, "
          "display_name = ?, "
          "avatar = ?, "
          "updated_at = ? "
          "WHERE id = ?",
          persona.human_id().value(),
          persona.display_name(),
          persona.avatar(),
          persona.updated_at(),
          persona.id().value());

      return RepositoryStatus::success();
    }
    catch (const std::exception &error)
    {
      if (unique_constraint_error(error.what()))
      {
        return RepositoryStatus::failure(
            persona_conflict_error());
      }

      return RepositoryStatus::failure(
          storage_error(error.what()));
    }
    catch (...)
    {
      return RepositoryStatus::failure(
          storage_error("Unknown database error."));
    }
  }

  RepositoryResult<std::optional<domain::Persona>>
  DbIdentityRepository::find_persona_by_id(
      const domain::PersonaId &id) const
  {
    if (!id.valid())
    {
      return RepositoryResult<std::optional<domain::Persona>>::failure(
          invalid_persona_error());
    }

    if (auto status = require_ready(); status.failed())
    {
      return RepositoryResult<std::optional<domain::Persona>>::failure(
          status.error());
    }

    try
    {
      auto result = database_->query(
          "SELECT id, human_id, display_name, avatar, created_at, updated_at "
          "FROM identity_personas "
          "WHERE id = ? "
          "LIMIT 1",
          id.value());

      if (!result->next())
      {
        return RepositoryResult<std::optional<domain::Persona>>::success(
            std::nullopt);
      }

      return RepositoryResult<std::optional<domain::Persona>>::success(
          persona_from_row(result->row()));
    }
    catch (const std::exception &error)
    {
      return RepositoryResult<std::optional<domain::Persona>>::failure(
          storage_error(error.what()));
    }
    catch (...)
    {
      return RepositoryResult<std::optional<domain::Persona>>::failure(
          storage_error("Unknown database error."));
    }
  }

  RepositoryResult<std::optional<domain::Persona>>
  DbIdentityRepository::find_persona_by_human_id(
      const domain::HumanId &human_id) const
  {
    if (!human_id.valid())
    {
      return RepositoryResult<std::optional<domain::Persona>>::failure(
          invalid_persona_error());
    }

    if (auto status = require_ready(); status.failed())
    {
      return RepositoryResult<std::optional<domain::Persona>>::failure(
          status.error());
    }

    try
    {
      auto result = database_->query(
          "SELECT id, human_id, display_name, avatar, created_at, updated_at "
          "FROM identity_personas "
          "WHERE human_id = ? "
          "LIMIT 1",
          human_id.value());

      if (!result->next())
      {
        return RepositoryResult<std::optional<domain::Persona>>::success(
            std::nullopt);
      }

      return RepositoryResult<std::optional<domain::Persona>>::success(
          persona_from_row(result->row()));
    }
    catch (const std::exception &error)
    {
      return RepositoryResult<std::optional<domain::Persona>>::failure(
          storage_error(error.what()));
    }
    catch (...)
    {
      return RepositoryResult<std::optional<domain::Persona>>::failure(
          storage_error("Unknown database error."));
    }
  }

  RepositoryStatus DbIdentityRepository::ensure_schema()
  {
    try
    {
      database_->exec(
          "CREATE TABLE IF NOT EXISTS identity_humans ("
          "id VARCHAR(128) NOT NULL PRIMARY KEY,"
          "account_id VARCHAR(128) NOT NULL UNIQUE,"
          "created_at BIGINT NOT NULL,"
          "updated_at BIGINT NOT NULL"
          ")");

      database_->exec(
          "CREATE INDEX IF NOT EXISTS idx_identity_humans_account_id "
          "ON identity_humans (account_id)");

      database_->exec(
          "CREATE TABLE IF NOT EXISTS identity_personas ("
          "id VARCHAR(128) NOT NULL PRIMARY KEY,"
          "human_id VARCHAR(128) NOT NULL UNIQUE,"
          "display_name VARCHAR(128) NOT NULL,"
          "avatar TEXT NOT NULL DEFAULT '',"
          "created_at BIGINT NOT NULL,"
          "updated_at BIGINT NOT NULL,"
          "FOREIGN KEY (human_id) REFERENCES identity_humans(id) "
          "ON DELETE CASCADE"
          ")");

      database_->exec(
          "CREATE INDEX IF NOT EXISTS idx_identity_personas_human_id "
          "ON identity_personas (human_id)");

      schema_status_ = RepositoryStatus::success();
      return schema_status_;
    }
    catch (const std::exception &error)
    {
      schema_status_ = RepositoryStatus::failure(
          storage_error(error.what()));

      return schema_status_;
    }
    catch (...)
    {
      schema_status_ = RepositoryStatus::failure(
          storage_error("Unknown database error."));

      return schema_status_;
    }
  }

  bool DbIdentityRepository::ready() const noexcept
  {
    return schema_status_.ok();
  }

  const RepositoryStatus &
  DbIdentityRepository::schema_status() const noexcept
  {
    return schema_status_;
  }

  domain::Human DbIdentityRepository::human_from_row(
      const vix::db::ResultRow &row)
  {
    return domain::Human{
        domain::HumanId{row.getString(0)},
        domain::AccountId{row.getString(1)},
        row.getInt64(2),
        row.getInt64(3)};
  }

  domain::Persona DbIdentityRepository::persona_from_row(
      const vix::db::ResultRow &row)
  {
    return domain::Persona{
        domain::PersonaId{row.getString(0)},
        domain::HumanId{row.getString(1)},
        row.getString(2),
        row.getString(3),
        row.getInt64(4),
        row.getInt64(5)};
  }

  errors::IdentityError DbIdentityRepository::storage_error(
      std::string message)
  {
    return errors::make_identity_error(
        errors::IdentityErrorCode::StorageError,
        std::move(message));
  }

  errors::IdentityError
  DbIdentityRepository::invalid_human_error()
  {
    return errors::make_identity_error(
        errors::IdentityErrorCode::InvalidInput,
        "Human identity is invalid.");
  }

  errors::IdentityError
  DbIdentityRepository::invalid_persona_error()
  {
    return errors::make_identity_error(
        errors::IdentityErrorCode::InvalidInput,
        "Persona is invalid.");
  }

  errors::IdentityError
  DbIdentityRepository::human_not_found_error()
  {
    return errors::make_identity_error(
        errors::IdentityErrorCode::HumanNotFound,
        "Human identity was not found.");
  }

  errors::IdentityError
  DbIdentityRepository::persona_not_found_error()
  {
    return errors::make_identity_error(
        errors::IdentityErrorCode::PersonaNotFound,
        "Persona was not found.");
  }

  errors::IdentityError
  DbIdentityRepository::human_conflict_error()
  {
    return errors::make_identity_error(
        errors::IdentityErrorCode::AccountAlreadyExists,
        "A human identity already exists for this account.");
  }

  errors::IdentityError
  DbIdentityRepository::persona_conflict_error()
  {
    return errors::make_identity_error(
        errors::IdentityErrorCode::InvalidInput,
        "A persona already exists for this human identity.");
  }

  bool DbIdentityRepository::unique_constraint_error(
      std::string_view message)
  {
    std::string lower(message);

    std::transform(
        lower.begin(),
        lower.end(),
        lower.begin(),
        [](unsigned char character)
        {
          return static_cast<char>(
              std::tolower(character));
        });

    return lower.find("unique constraint failed") != std::string::npos ||
           lower.find("duplicate key") != std::string::npos ||
           lower.find("duplicate entry") != std::string::npos;
  }

  RepositoryStatus DbIdentityRepository::require_ready() const
  {
    if (schema_status_.failed())
    {
      return RepositoryStatus::failure(
          schema_status_.error());
    }

    return RepositoryStatus::success();
  }
} // namespace orelunza::identity::repositories
