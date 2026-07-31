/**
 *
 * @file Human.hpp
 * @author Softadastra
 * @brief Human domain model for the Orelunza identity module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_IDENTITY_DOMAIN_HUMAN_HPP_INCLUDED
#define ORELUNZA_IDENTITY_DOMAIN_HUMAN_HPP_INCLUDED

#include <identity/domain/IdentityIds.hpp>

#include <cstdint>
#include <utility>

namespace orelunza::identity::domain
{
  /**
   * @brief Represents the private human identity attached to an account.
   *
   * A Human belongs to exactly one Account and acts as the stable private
   * identity behind one or more public personas.
   */
  class Human
  {
  public:
    /**
     * @brief Construct an empty human identity.
     */
    Human() = default;

    /**
     * @brief Construct a human identity.
     *
     * @param id Human identifier.
     * @param account_id Owning account identifier.
     * @param created_at Creation time in epoch seconds.
     * @param updated_at Last update time in epoch seconds.
     */
    Human(
        HumanId id,
        AccountId account_id,
        std::int64_t created_at,
        std::int64_t updated_at)
        : id_(std::move(id)),
          account_id_(std::move(account_id)),
          created_at_(created_at),
          updated_at_(updated_at)
    {
    }

    /**
     * @brief Return the human identifier.
     *
     * @return Human identifier.
     */
    [[nodiscard]] const HumanId &id() const noexcept
    {
      return id_;
    }

    /**
     * @brief Return the owning account identifier.
     *
     * @return Account identifier.
     */
    [[nodiscard]] const AccountId &account_id() const noexcept
    {
      return account_id_;
    }

    /**
     * @brief Return the creation time.
     *
     * @return Creation time in epoch seconds.
     */
    [[nodiscard]] std::int64_t created_at() const noexcept
    {
      return created_at_;
    }

    /**
     * @brief Return the last update time.
     *
     * @return Last update time in epoch seconds.
     */
    [[nodiscard]] std::int64_t updated_at() const noexcept
    {
      return updated_at_;
    }

    /**
     * @brief Return whether the human identity contains valid domain data.
     *
     * @return true when the human identity is valid.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return id_.valid() &&
             account_id_.valid() &&
             created_at_ >= 0 &&
             updated_at_ >= created_at_;
    }

    /**
     * @brief Test whether this human has the supplied identifier.
     *
     * @param id Human identifier.
     * @return true when the identifiers match.
     */
    [[nodiscard]] bool has_id(const HumanId &id) const noexcept
    {
      return id_ == id;
    }

    /**
     * @brief Test whether this human belongs to an account.
     *
     * @param account_id Account identifier.
     * @return true when the account identifiers match.
     */
    [[nodiscard]] bool belongs_to(
        const AccountId &account_id) const noexcept
    {
      return account_id_ == account_id;
    }

    /**
     * @brief Change the last update time.
     *
     * @param updated_at New update time in epoch seconds.
     */
    void set_updated_at(std::int64_t updated_at) noexcept
    {
      updated_at_ = updated_at;
    }

  private:
    HumanId id_;
    AccountId account_id_;

    std::int64_t created_at_ = 0;
    std::int64_t updated_at_ = 0;
  };
} // namespace orelunza::identity::domain

#endif // ORELUNZA_IDENTITY_DOMAIN_HUMAN_HPP_INCLUDED
