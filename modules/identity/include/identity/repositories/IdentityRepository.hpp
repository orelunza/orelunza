/**
 *
 * @file IdentityRepository.hpp
 * @author Softadastra
 * @brief Persistence contract for Orelunza human identities and personas.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_IDENTITY_REPOSITORIES_IDENTITY_REPOSITORY_HPP_INCLUDED
#define ORELUNZA_IDENTITY_REPOSITORIES_IDENTITY_REPOSITORY_HPP_INCLUDED

#include <identity/domain/Human.hpp>
#include <identity/domain/Persona.hpp>
#include <identity/errors/IdentityError.hpp>

#include <optional>
#include <utility>

namespace orelunza::identity::repositories
{
  /**
   * @brief Result returned by repository operations.
   *
   * @tparam T Successful value type.
   */
  template <typename T>
  class RepositoryResult
  {
  public:
    /**
     * @brief Create a successful repository result.
     *
     * @param value Successful value.
     * @return Successful result.
     */
    [[nodiscard]] static RepositoryResult success(T value)
    {
      return RepositoryResult{std::move(value)};
    }

    /**
     * @brief Create a failed repository result.
     *
     * @param error Identity error.
     * @return Failed result.
     */
    [[nodiscard]] static RepositoryResult failure(
        errors::IdentityError error)
    {
      return RepositoryResult{std::move(error)};
    }

    /**
     * @brief Return whether the operation succeeded.
     *
     * @return true when a value is available.
     */
    [[nodiscard]] bool ok() const noexcept
    {
      return value_.has_value() && error_.ok();
    }

    /**
     * @brief Return whether the operation failed.
     *
     * @return true when the operation failed.
     */
    [[nodiscard]] bool failed() const noexcept
    {
      return !ok();
    }

    /**
     * @brief Return the successful value.
     *
     * The caller must verify that the operation succeeded first.
     *
     * @return Successful value.
     */
    [[nodiscard]] T &value() &
    {
      return *value_;
    }

    /**
     * @brief Return the successful value.
     *
     * The caller must verify that the operation succeeded first.
     *
     * @return Successful value.
     */
    [[nodiscard]] const T &value() const &
    {
      return *value_;
    }

    /**
     * @brief Move the successful value out of the result.
     *
     * @return Successful value.
     */
    [[nodiscard]] T &&value() &&
    {
      return std::move(*value_);
    }

    /**
     * @brief Return the operation error.
     *
     * @return Identity error.
     */
    [[nodiscard]] const errors::IdentityError &error() const noexcept
    {
      return error_;
    }

  private:
    explicit RepositoryResult(T value)
        : value_(std::move(value))
    {
    }

    explicit RepositoryResult(errors::IdentityError error)
        : error_(std::move(error))
    {
    }

    std::optional<T> value_;
    errors::IdentityError error_;
  };

  /**
   * @brief Status returned by repository operations without a value.
   */
  class RepositoryStatus
  {
  public:
    /**
     * @brief Construct a successful repository status.
     */
    RepositoryStatus() = default;

    /**
     * @brief Create a successful repository status.
     *
     * @return Successful status.
     */
    [[nodiscard]] static RepositoryStatus success()
    {
      return RepositoryStatus{};
    }

    /**
     * @brief Create a failed repository status.
     *
     * @param error Identity error.
     * @return Failed status.
     */
    [[nodiscard]] static RepositoryStatus failure(
        errors::IdentityError error)
    {
      return RepositoryStatus{std::move(error)};
    }

    /**
     * @brief Return whether the operation succeeded.
     *
     * @return true when no error occurred.
     */
    [[nodiscard]] bool ok() const noexcept
    {
      return error_.ok();
    }

    /**
     * @brief Return whether the operation failed.
     *
     * @return true when an error occurred.
     */
    [[nodiscard]] bool failed() const noexcept
    {
      return !ok();
    }

    /**
     * @brief Return the operation error.
     *
     * @return Identity error.
     */
    [[nodiscard]] const errors::IdentityError &error() const noexcept
    {
      return error_;
    }

  private:
    explicit RepositoryStatus(errors::IdentityError error)
        : error_(std::move(error))
    {
    }

    errors::IdentityError error_;
  };

  /**
   * @brief Persistence contract owned by the identity module.
   *
   * Authentication users and sessions remain owned by the authentication
   * provider. This repository stores Orelunza Human and Persona models only.
   */
  class IdentityRepository
  {
  public:
    virtual ~IdentityRepository() = default;

    /**
     * @brief Persist a new human identity.
     *
     * @param human Human identity to create.
     * @return Operation status.
     */
    [[nodiscard]] virtual RepositoryStatus
    create_human(const domain::Human &human) = 0;

    /**
     * @brief Update an existing human identity.
     *
     * @param human Human identity to update.
     * @return Operation status.
     */
    [[nodiscard]] virtual RepositoryStatus
    update_human(const domain::Human &human) = 0;

    /**
     * @brief Find a human identity by identifier.
     *
     * @param id Human identifier.
     * @return Optional human identity.
     */
    [[nodiscard]] virtual RepositoryResult<std::optional<domain::Human>>
    find_human_by_id(const domain::HumanId &id) const = 0;

    /**
     * @brief Find the human identity attached to an account.
     *
     * @param account_id Account identifier.
     * @return Optional human identity.
     */
    [[nodiscard]] virtual RepositoryResult<std::optional<domain::Human>>
    find_human_by_account_id(
        const domain::AccountId &account_id) const = 0;

    /**
     * @brief Persist a new public persona.
     *
     * @param persona Persona to create.
     * @return Operation status.
     */
    [[nodiscard]] virtual RepositoryStatus
    create_persona(const domain::Persona &persona) = 0;

    /**
     * @brief Update an existing public persona.
     *
     * @param persona Persona to update.
     * @return Operation status.
     */
    [[nodiscard]] virtual RepositoryStatus
    update_persona(const domain::Persona &persona) = 0;

    /**
     * @brief Find a public persona by identifier.
     *
     * @param id Persona identifier.
     * @return Optional persona.
     */
    [[nodiscard]] virtual RepositoryResult<std::optional<domain::Persona>>
    find_persona_by_id(const domain::PersonaId &id) const = 0;

    /**
     * @brief Find the public persona attached to a human identity.
     *
     * @param human_id Human identifier.
     * @return Optional persona.
     */
    [[nodiscard]] virtual RepositoryResult<std::optional<domain::Persona>>
    find_persona_by_human_id(
        const domain::HumanId &human_id) const = 0;
  };
} // namespace orelunza::identity::repositories

#endif // ORELUNZA_IDENTITY_REPOSITORIES_IDENTITY_REPOSITORY_HPP_INCLUDED
