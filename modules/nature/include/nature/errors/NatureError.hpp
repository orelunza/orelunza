/**
 *
 * @file NatureError.hpp
 * @author Softadastra
 * @brief Stable error model for the Orelunza nature module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_NATURE_ERRORS_NATURE_ERROR_HPP_INCLUDED
#define ORELUNZA_NATURE_ERRORS_NATURE_ERROR_HPP_INCLUDED

#include <string>
#include <string_view>
#include <utility>

namespace orelunza::nature::errors
{
  /**
   * @brief Stable error codes exposed by the nature module.
   */
  enum class NatureErrorCode
  {
    None,

    InvalidInput,
    InvalidBiomeId,
    InvalidNaturalAreaId,
    InvalidRegionId,
    InvalidPlaceId,

    BiomeNotFound,
    NaturalAreaNotFound,
    EnvironmentStateNotFound,
    RegionNotFound,
    PlaceNotFound,

    BiomeDisabled,
    NaturalAreaDisabled,

    StorageError,
    ConfigurationError,
    Unknown
  };

  /**
   * @brief Represents a stable nature module error.
   */
  class NatureError
  {
  public:
    /**
     * @brief Construct a success error value.
     */
    NatureError() = default;

    /**
     * @brief Construct an error.
     *
     * @param code Stable error code.
     * @param message Human-readable error message.
     */
    NatureError(
        NatureErrorCode code,
        std::string message)
        : code_(code),
          message_(std::move(message))
    {
    }

    /**
     * @brief Return the stable error code.
     *
     * @return Error code.
     */
    [[nodiscard]] NatureErrorCode code() const noexcept
    {
      return code_;
    }

    /**
     * @brief Return the human-readable error message.
     *
     * @return Error message.
     */
    [[nodiscard]] const std::string &message() const noexcept
    {
      return message_;
    }

    /**
     * @brief Return whether this value represents success.
     *
     * @return true when the error code is None.
     */
    [[nodiscard]] bool ok() const noexcept
    {
      return code_ == NatureErrorCode::None;
    }

    /**
     * @brief Return whether this value represents failure.
     *
     * @return true when an error is present.
     */
    [[nodiscard]] bool failed() const noexcept
    {
      return !ok();
    }

    /**
     * @brief Return whether this value contains an error.
     *
     * @return true when an error is present.
     */
    [[nodiscard]] bool has_error() const noexcept
    {
      return failed();
    }

    /**
     * @brief Test whether the error has a specific code.
     *
     * @param code Expected error code.
     * @return true when the codes match.
     */
    [[nodiscard]] bool is(NatureErrorCode code) const noexcept
    {
      return code_ == code;
    }

    /**
     * @brief Convert the error to a boolean state.
     *
     * @return true when an error is present.
     */
    explicit operator bool() const noexcept
    {
      return failed();
    }

  private:
    NatureErrorCode code_ = NatureErrorCode::None;
    std::string message_;
  };

  /**
   * @brief Convert a nature error code to its stable string representation.
   *
   * @param code Nature error code.
   * @return Stable error name.
   */
  [[nodiscard]] std::string_view to_string(
      NatureErrorCode code) noexcept;

  /**
   * @brief Convert a nature error to its stable string representation.
   *
   * @param error Nature error.
   * @return Stable error name.
   */
  [[nodiscard]] std::string_view to_string(
      const NatureError &error) noexcept;

  /**
   * @brief Create a success error value.
   *
   * @return Successful NatureError.
   */
  [[nodiscard]] NatureError make_nature_ok() noexcept;

  /**
   * @brief Create a nature error.
   *
   * @param code Stable error code.
   * @param message Human-readable error message.
   * @return NatureError value.
   */
  [[nodiscard]] NatureError make_nature_error(
      NatureErrorCode code,
      std::string message);
} // namespace orelunza::nature::errors

#endif // ORELUNZA_NATURE_ERRORS_NATURE_ERROR_HPP_INCLUDED
