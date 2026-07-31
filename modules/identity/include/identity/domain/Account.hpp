/**
 *
 * @file Account.hpp
 * @author Softadastra
 * @brief Account domain model for the Orelunza identity module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_IDENTITY_DOMAIN_ACCOUNT_HPP_INCLUDED
#define ORELUNZA_IDENTITY_DOMAIN_ACCOUNT_HPP_INCLUDED

#include <identity/domain/IdentityIds.hpp>

#include <cstdint>
#include <string>
#include <string_view>
#include <utility>

namespace orelunza::identity::domain
{
  /**
   * @brief Represents an Orelunza account.
   *
   * Account contains identity-facing account information only. Password
   * hashes, credentials, and authentication internals remain owned by the
   * authentication provider.
   */
  class Account
  {
  public:
    /**
     * @brief Construct an empty account.
     */
    Account() = default;

    /**
     * @brief Construct an account.
     *
     * @param id Account identifier.
     * @param email Normalized email address.
     * @param email_verified Whether the email address has been verified.
     * @param active Whether the account is active.
     * @param created_at Account creation time in epoch seconds.
     * @param updated_at Last update time in epoch seconds.
     */
    Account(
        AccountId id,
        std::string email,
        bool email_verified,
        bool active,
        std::int64_t created_at,
        std::int64_t updated_at)
        : id_(std::move(id)),
          email_(std::move(email)),
          email_verified_(email_verified),
          active_(active),
          created_at_(created_at),
          updated_at_(updated_at)
    {
    }

    /**
     * @brief Return the account identifier.
     *
     * @return Account identifier.
     */
    [[nodiscard]] const AccountId &id() const noexcept
    {
      return id_;
    }

    /**
     * @brief Return the normalized email address.
     *
     * @return Account email address.
     */
    [[nodiscard]] const std::string &email() const noexcept
    {
      return email_;
    }

    /**
     * @brief Return whether the email address is verified.
     *
     * @return true when the email address is verified.
     */
    [[nodiscard]] bool email_verified() const noexcept
    {
      return email_verified_;
    }

    /**
     * @brief Return whether the account is active.
     *
     * @return true when the account is active.
     */
    [[nodiscard]] bool active() const noexcept
    {
      return active_;
    }

    /**
     * @brief Return whether the account is disabled.
     *
     * @return true when the account is not active.
     */
    [[nodiscard]] bool disabled() const noexcept
    {
      return !active_;
    }

    /**
     * @brief Return the account creation time.
     *
     * @return Creation time in epoch seconds.
     */
    [[nodiscard]] std::int64_t created_at() const noexcept
    {
      return created_at_;
    }

    /**
     * @brief Return the last account update time.
     *
     * @return Last update time in epoch seconds.
     */
    [[nodiscard]] std::int64_t updated_at() const noexcept
    {
      return updated_at_;
    }

    /**
     * @brief Return whether the account contains valid domain data.
     *
     * @return true when the account is valid.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return id_.valid() &&
             !email_.empty() &&
             created_at_ >= 0 &&
             updated_at_ >= created_at_;
    }

    /**
     * @brief Test whether this account has the supplied identifier.
     *
     * @param id Account identifier.
     * @return true when the identifiers match.
     */
    [[nodiscard]] bool has_id(const AccountId &id) const noexcept
    {
      return id_ == id;
    }

    /**
     * @brief Test whether this account has the supplied email address.
     *
     * The email passed to this function is expected to already be normalized.
     *
     * @param email Email address.
     * @return true when the email addresses match.
     */
    [[nodiscard]] bool has_email(std::string_view email) const noexcept
    {
      return email_ == email;
    }

    /**
     * @brief Replace the account email address.
     *
     * @param email New normalized email address.
     */
    void set_email(std::string email)
    {
      email_ = std::move(email);
    }

    /**
     * @brief Change the email verification state.
     *
     * @param verified New verification state.
     */
    void set_email_verified(bool verified) noexcept
    {
      email_verified_ = verified;
    }

    /**
     * @brief Change the account activation state.
     *
     * @param active New activation state.
     */
    void set_active(bool active) noexcept
    {
      active_ = active;
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
    AccountId id_;
    std::string email_;

    bool email_verified_ = false;
    bool active_ = true;

    std::int64_t created_at_ = 0;
    std::int64_t updated_at_ = 0;
  };
} // namespace orelunza::identity::domain

#endif // ORELUNZA_IDENTITY_DOMAIN_ACCOUNT_HPP_INCLUDED
