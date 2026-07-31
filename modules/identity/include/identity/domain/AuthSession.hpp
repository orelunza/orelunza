/**
 *
 * @file AuthSession.hpp
 * @author Softadastra
 * @brief Authentication session domain model for the Orelunza identity module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_IDENTITY_DOMAIN_AUTH_SESSION_HPP_INCLUDED
#define ORELUNZA_IDENTITY_DOMAIN_AUTH_SESSION_HPP_INCLUDED

#include <identity/domain/IdentityIds.hpp>

#include <cstdint>
#include <utility>

namespace orelunza::identity::domain
{
  /**
   * @brief Represents an authenticated Orelunza account session.
   *
   * AuthSession is independent from the concrete authentication provider.
   * Provider-specific session models must be converted to this type before
   * being exposed to the rest of Orelunza.
   */
  class AuthSession
  {
  public:
    /**
     * @brief Construct an empty authentication session.
     */
    AuthSession() = default;

    /**
     * @brief Construct an authentication session.
     *
     * @param id Session identifier.
     * @param account_id Authenticated account identifier.
     * @param created_at Creation time in epoch seconds.
     * @param expires_at Expiration time in epoch seconds.
     * @param last_seen_at Last activity time in epoch seconds.
     * @param revoked Whether the session has been revoked.
     */
    AuthSession(
        AuthSessionId id,
        AccountId account_id,
        std::int64_t created_at,
        std::int64_t expires_at,
        std::int64_t last_seen_at,
        bool revoked = false)
        : id_(std::move(id)),
          account_id_(std::move(account_id)),
          created_at_(created_at),
          expires_at_(expires_at),
          last_seen_at_(last_seen_at),
          revoked_(revoked)
    {
    }

    /**
     * @brief Return the session identifier.
     *
     * @return Session identifier.
     */
    [[nodiscard]] const AuthSessionId &id() const noexcept
    {
      return id_;
    }

    /**
     * @brief Return the authenticated account identifier.
     *
     * @return Account identifier.
     */
    [[nodiscard]] const AccountId &account_id() const noexcept
    {
      return account_id_;
    }

    /**
     * @brief Return the session creation time.
     *
     * @return Creation time in epoch seconds.
     */
    [[nodiscard]] std::int64_t created_at() const noexcept
    {
      return created_at_;
    }

    /**
     * @brief Return the session expiration time.
     *
     * @return Expiration time in epoch seconds.
     */
    [[nodiscard]] std::int64_t expires_at() const noexcept
    {
      return expires_at_;
    }

    /**
     * @brief Return the last activity time.
     *
     * @return Last activity time in epoch seconds.
     */
    [[nodiscard]] std::int64_t last_seen_at() const noexcept
    {
      return last_seen_at_;
    }

    /**
     * @brief Return whether the session has been revoked.
     *
     * @return true when the session is revoked.
     */
    [[nodiscard]] bool revoked() const noexcept
    {
      return revoked_;
    }

    /**
     * @brief Return whether the session has expired.
     *
     * @param now Current time in epoch seconds.
     * @return true when the session has expired.
     */
    [[nodiscard]] bool expired(std::int64_t now) const noexcept
    {
      return now >= expires_at_;
    }

    /**
     * @brief Return whether the session can currently be used.
     *
     * @param now Current time in epoch seconds.
     * @return true when the session is valid, active, and not expired.
     */
    [[nodiscard]] bool usable(std::int64_t now) const noexcept
    {
      return valid() && !revoked_ && !expired(now);
    }

    /**
     * @brief Return whether the session contains valid domain data.
     *
     * @return true when the session is valid.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return id_.valid() &&
             account_id_.valid() &&
             created_at_ >= 0 &&
             expires_at_ > created_at_ &&
             last_seen_at_ >= created_at_;
    }

    /**
     * @brief Test whether this session has the supplied identifier.
     *
     * @param id Session identifier.
     * @return true when the identifiers match.
     */
    [[nodiscard]] bool has_id(
        const AuthSessionId &id) const noexcept
    {
      return id_ == id;
    }

    /**
     * @brief Test whether this session belongs to an account.
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
     * @brief Update the last activity time.
     *
     * @param last_seen_at New activity time in epoch seconds.
     */
    void touch(std::int64_t last_seen_at) noexcept
    {
      last_seen_at_ = last_seen_at;
    }

    /**
     * @brief Update the session expiration time.
     *
     * @param expires_at New expiration time in epoch seconds.
     */
    void set_expires_at(std::int64_t expires_at) noexcept
    {
      expires_at_ = expires_at;
    }

    /**
     * @brief Revoke the session.
     */
    void revoke() noexcept
    {
      revoked_ = true;
    }

  private:
    AuthSessionId id_;
    AccountId account_id_;

    std::int64_t created_at_ = 0;
    std::int64_t expires_at_ = 0;
    std::int64_t last_seen_at_ = 0;

    bool revoked_ = false;
  };
} // namespace orelunza::identity::domain

#endif // ORELUNZA_IDENTITY_DOMAIN_AUTH_SESSION_HPP_INCLUDED
