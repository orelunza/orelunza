/**
 *
 * @file DbIdentityRepository.hpp
 * @author Softadastra
 * @brief Database identity repository for Orelunza.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_IDENTITY_REPOSITORIES_DB_IDENTITY_REPOSITORY_HPP_INCLUDED
#define ORELUNZA_IDENTITY_REPOSITORIES_DB_IDENTITY_REPOSITORY_HPP_INCLUDED

#include <identity/repositories/IdentityRepository.hpp>

#include <string>
#include <string_view>

namespace vix::db
{
  class Database;
  struct ResultRow;
}

namespace orelunza::identity::repositories
{
  /**
   * @brief Database-backed repository for Human and Persona models.
   *
   * The repository expects the following tables:
   *
   * - identity_humans
   * - identity_personas
   */
  class DbIdentityRepository final : public IdentityRepository
  {
  public:
    /**
     * @brief Construct a database-backed identity repository.
     *
     * @param database Vix database facade.
     * @param create_schema Whether the repository should create its tables.
     */
    explicit DbIdentityRepository(
        vix::db::Database &database,
        bool create_schema = true);

    ~DbIdentityRepository() override = default;

    DbIdentityRepository(const DbIdentityRepository &) = delete;
    DbIdentityRepository &operator=(const DbIdentityRepository &) = delete;

    [[nodiscard]] RepositoryStatus
    create_human(const domain::Human &human) override;

    [[nodiscard]] RepositoryStatus
    update_human(const domain::Human &human) override;

    [[nodiscard]] RepositoryResult<std::optional<domain::Human>>
    find_human_by_id(const domain::HumanId &id) const override;

    [[nodiscard]] RepositoryResult<std::optional<domain::Human>>
    find_human_by_account_id(
        const domain::AccountId &account_id) const override;

    [[nodiscard]] RepositoryStatus
    create_persona(const domain::Persona &persona) override;

    [[nodiscard]] RepositoryStatus
    update_persona(const domain::Persona &persona) override;

    [[nodiscard]] RepositoryResult<std::optional<domain::Persona>>
    find_persona_by_id(const domain::PersonaId &id) const override;

    [[nodiscard]] RepositoryResult<std::optional<domain::Persona>>
    find_persona_by_human_id(
        const domain::HumanId &human_id) const override;

    /**
     * @brief Create the tables and indexes required by this repository.
     *
     * @return Schema initialization status.
     */
    [[nodiscard]] RepositoryStatus ensure_schema();

    /**
     * @brief Return whether the repository is ready.
     *
     * @return true when schema initialization succeeded.
     */
    [[nodiscard]] bool ready() const noexcept;

    /**
     * @brief Return the schema initialization status.
     *
     * @return Schema status.
     */
    [[nodiscard]] const RepositoryStatus &schema_status() const noexcept;

  private:
    [[nodiscard]] static domain::Human human_from_row(
        const vix::db::ResultRow &row);

    [[nodiscard]] static domain::Persona persona_from_row(
        const vix::db::ResultRow &row);

    [[nodiscard]] static errors::IdentityError storage_error(
        std::string message);

    [[nodiscard]] static errors::IdentityError invalid_human_error();

    [[nodiscard]] static errors::IdentityError invalid_persona_error();

    [[nodiscard]] static errors::IdentityError human_not_found_error();

    [[nodiscard]] static errors::IdentityError persona_not_found_error();

    [[nodiscard]] static errors::IdentityError human_conflict_error();

    [[nodiscard]] static errors::IdentityError persona_conflict_error();

    [[nodiscard]] static bool unique_constraint_error(
        std::string_view message);

    [[nodiscard]] RepositoryStatus require_ready() const;

    vix::db::Database *database_ = nullptr;
    RepositoryStatus schema_status_;
  };
} // namespace orelunza::identity::repositories

#endif // ORELUNZA_IDENTITY_REPOSITORIES_DB_IDENTITY_REPOSITORY_HPP_INCLUDED
