/**
 *
 * @file IdentityError.hpp
 * @author Softadastra
 * @brief Error types for the Orelunza identity module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_IDENTITY_ERRORS_IDENTITY_ERROR_HPP_INCLUDED
#define ORELUNZA_IDENTITY_ERRORS_IDENTITY_ERROR_HPP_INCLUDED

#include <string>
#include <string_view>

namespace orelunza::identity::errors
{
  /**
   * @brief Stable error codes produced by the identity module.
   */
  enum class IdentityErrorCode
  {
    None = 0,

    InvalidInput,
    InvalidEmail,
    InvalidPassword,
    InvalidCredentials,

    AccountNotFound,
    AccountAlreadyExists,
    AccountDisabled,
    EmailVerificationRequired,

    HumanNotFound,
    PersonaNotFound,

    InvalidSession,
    SessionExpired,
    SessionRevoked,

    StorageError,
    AuthProviderError,
    ConfigurationError,

    Unknown
  };

  /**
   * @brief Represents an identity module failure.
   */
  class IdentityError
  {
  public:
    /**
     * @brief Construct an empty successful error state.
     */
    IdentityError() = default;

    /**
     * @brief Construct an identity error.
     *
     * @param code Stable identity error code.
     * @param message Human-readable diagnostic message.
     */
    IdentityError(
        IdentityErrorCode code,
        std::string message);

    /**
     * @brief Return whether this value represents no error.
     *
     * @return true when the error code is None.
     */
    [[nodiscard]] bool ok() const noexcept;

    /**
     * @brief Return whether this value represents an error.
     *
     * @return true when the error code is not None.
     */
    [[nodiscard]] bool has_error() const noexcept;

    /**
     * @brief Return the stable error code.
     *
     * @return Identity error code.
     */
    [[nodiscard]] IdentityErrorCode code() const noexcept;

    /**
     * @brief Return the human-readable diagnostic message.
     *
     * @return Error message.
     */
    [[nodiscard]] const std::string &message() const noexcept;

    /**
     * @brief Test whether this error has the supplied code.
     *
     * @param code Error code to compare.
     * @return true when the codes match.
     */
    [[nodiscard]] bool is(
        IdentityErrorCode code) const noexcept;

  private:
    IdentityErrorCode code_ = IdentityErrorCode::None;
    std::string message_;
  };

  /**
   * @brief Convert an identity error code to a stable string.
   *
   * @param code Identity error code.
   * @return Stable snake_case representation.
   */
  [[nodiscard]] std::string_view to_string(
      IdentityErrorCode code) noexcept;

  /**
   * @brief Create a successful identity error state.
   *
   * @return Empty identity error.
   */
  [[nodiscard]] IdentityError make_identity_ok();

  /**
   * @brief Create an identity error.
   *
   * @param code Stable identity error code.
   * @param message Human-readable diagnostic message.
   * @return Constructed identity error.
   */
  [[nodiscard]] IdentityError make_identity_error(
      IdentityErrorCode code,
      std::string message);
} // namespace orelunza::identity::errors

#endif // ORELUNZA_IDENTITY_ERRORS_IDENTITY_ERROR_HPP_INCLUDED
