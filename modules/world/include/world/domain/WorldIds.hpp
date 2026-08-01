/**
 *
 * @file WorldIds.hpp
 * @author Softadastra
 * @brief Strongly typed identifiers for the Orelunza world module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_WORLD_DOMAIN_WORLD_IDS_HPP_INCLUDED
#define ORELUNZA_WORLD_DOMAIN_WORLD_IDS_HPP_INCLUDED

#include <compare>
#include <cstddef>
#include <functional>
#include <string>
#include <string_view>
#include <utility>

namespace orelunza::world::domain
{
  /**
   * @brief Strongly typed world identifier.
   *
   * @tparam Tag Type used to distinguish identifier categories.
   */
  template <typename Tag>
  class WorldIdentifier
  {
  public:
    /**
     * @brief Construct an empty identifier.
     */
    WorldIdentifier() = default;

    /**
     * @brief Construct an identifier from a string.
     *
     * @param value Identifier value.
     */
    explicit WorldIdentifier(std::string value)
        : value_(std::move(value))
    {
    }

    /**
     * @brief Return the underlying identifier value.
     *
     * @return Identifier string.
     */
    [[nodiscard]] const std::string &value() const noexcept
    {
      return value_;
    }

    /**
     * @brief Return whether the identifier is empty.
     *
     * @return true when no value is stored.
     */
    [[nodiscard]] bool empty() const noexcept
    {
      return value_.empty();
    }

    /**
     * @brief Return whether the identifier contains a value.
     *
     * @return true when a value is stored.
     */
    [[nodiscard]] bool has_value() const noexcept
    {
      return !empty();
    }

    /**
     * @brief Return whether the identifier is valid.
     *
     * @return true when the identifier is non-empty.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return has_value();
    }

    /**
     * @brief Test whether the identifier matches a string value.
     *
     * @param value Expected identifier value.
     * @return true when the values match.
     */
    [[nodiscard]] bool is(std::string_view value) const noexcept
    {
      return value_ == value;
    }

    /**
     * @brief Convert the identifier to a boolean state.
     *
     * @return true when the identifier is valid.
     */
    explicit operator bool() const noexcept
    {
      return valid();
    }

    auto operator<=>(const WorldIdentifier &) const = default;

  private:
    std::string value_;
  };

  struct WorldIdTag
  {
  };

  struct RegionIdTag
  {
  };

  struct PlaceIdTag
  {
  };

  using WorldId = WorldIdentifier<WorldIdTag>;
  using RegionId = WorldIdentifier<RegionIdTag>;
  using PlaceId = WorldIdentifier<PlaceIdTag>;

  /**
   * @brief Hash function for strongly typed world identifiers.
   */
  struct WorldIdentifierHash
  {
    template <typename Tag>
    [[nodiscard]] std::size_t operator()(
        const WorldIdentifier<Tag> &identifier) const noexcept
    {
      return std::hash<std::string>{}(identifier.value());
    }
  };
} // namespace orelunza::world::domain

#endif // ORELUNZA_WORLD_DOMAIN_WORLD_IDS_HPP_INCLUDED
