/**
 *
 * @file NatureIds.hpp
 * @author Softadastra
 * @brief Strongly typed identifiers for the Orelunza nature module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_NATURE_DOMAIN_NATURE_IDS_HPP_INCLUDED
#define ORELUNZA_NATURE_DOMAIN_NATURE_IDS_HPP_INCLUDED

#include <compare>
#include <cstddef>
#include <functional>
#include <string>
#include <string_view>
#include <utility>

namespace orelunza::nature::domain
{
  /**
   * @brief Strongly typed nature identifier.
   *
   * @tparam Tag Type used to distinguish identifier categories.
   */
  template <typename Tag>
  class NatureIdentifier
  {
  public:
    /**
     * @brief Construct an empty identifier.
     */
    NatureIdentifier() = default;

    /**
     * @brief Construct an identifier from its string value.
     *
     * @param value Identifier value.
     */
    explicit NatureIdentifier(std::string value)
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

    auto operator<=>(const NatureIdentifier &) const = default;

  private:
    std::string value_;
  };

  struct BiomeIdTag
  {
  };

  struct NaturalAreaIdTag
  {
  };

  using BiomeId = NatureIdentifier<BiomeIdTag>;
  using NaturalAreaId = NatureIdentifier<NaturalAreaIdTag>;

  /**
   * @brief Hash function for strongly typed nature identifiers.
   */
  struct NatureIdentifierHash
  {
    template <typename Tag>
    [[nodiscard]] std::size_t operator()(
        const NatureIdentifier<Tag> &identifier) const noexcept
    {
      return std::hash<std::string>{}(identifier.value());
    }
  };
} // namespace orelunza::nature::domain

#endif // ORELUNZA_NATURE_DOMAIN_NATURE_IDS_HPP_INCLUDED
