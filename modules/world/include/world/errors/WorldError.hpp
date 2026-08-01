/**
 *
 * @file WorldError.hpp
 * @author Softadastra
 * @brief Stable error model for the Orelunza world module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_WORLD_ERRORS_WORLD_ERROR_HPP_INCLUDED
#define ORELUNZA_WORLD_ERRORS_WORLD_ERROR_HPP_INCLUDED

#include <string>
#include <string_view>
#include <utility>

namespace orelunza::world::errors
{
  /**
   * @brief Stable error codes exposed by the world module.
   */
  enum class WorldErrorCode
  {
    None,

    InvalidInput,
    InvalidWorldId,
    InvalidRegionId,
    InvalidPlaceId,

    WorldNotFound,
    RegionNotFound,
    PlaceNotFound,
    PositionNotFound,

    RegionDisabled,
    PlaceDisabled,

    StorageError,
    ConfigurationError,
    Unknown
  };

  /**
   * @brief Represents a stable world module error.
   */
  class WorldError
  {
  public:
    /**
     * @brief Construct a success error value.
     */
    WorldError() = default;

    /**
     * @brief Construct an error.
     *
     * @param code Stable error code.
     * @param message Human-readable error message.
     */
    WorldError(
        WorldErrorCode code,
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
    [[nodiscard]] WorldErrorCode code() const noexcept
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
      return code_ == WorldErrorCode::None;
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
    [[nodiscard]] bool is(WorldErrorCode code) const noexcept
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
    WorldErrorCode code_ = WorldErrorCode::None;
    std::string message_;
  };

  /**
   * @brief Convert a world error code to its stable string representation.
   *
   * @param code World error code.
   * @return Stable error name.
   */
  [[nodiscard]] std::string_view to_string(
      WorldErrorCode code) noexcept;

  /**
   * @brief Convert a world error to its stable string representation.
   *
   * @param error World error.
   * @return Stable error name.
   */
  [[nodiscard]] std::string_view to_string(
      const WorldError &error) noexcept;

  /**
   * @brief Create a success error value.
   *
   * @return Successful WorldError.
   */
  [[nodiscard]] WorldError make_world_ok() noexcept;

  /**
   * @brief Create a world error.
   *
   * @param code Stable error code.
   * @param message Human-readable error message.
   * @return WorldError value.
   */
  [[nodiscard]] WorldError make_world_error(
      WorldErrorCode code,
      std::string message);
} // namespace orelunza::world::errors

#endif // ORELUNZA_WORLD_ERRORS_WORLD_ERROR_HPP_INCLUDED
