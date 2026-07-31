/**
 *
 * @file IdentityIds.hpp
 * @author Softadastra
 * @brief Strong identifier types used by the Orelunza identity module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_IDENTITY_DOMAIN_IDENTITY_IDS_HPP_INCLUDED
#define ORELUNZA_IDENTITY_DOMAIN_IDENTITY_IDS_HPP_INCLUDED

#include <compare>
#include <cstddef>
#include <functional>
#include <string>
#include <string_view>
#include <utility>

namespace orelunza::identity::domain
{
  /**
   * @brief Strongly typed identity identifier.
   *
   * Different identifier categories cannot be mixed accidentally even though
   * they use strings internally.
   *
   * @tparam Tag Unique tag identifying the identifier category.
   */
  template <typename Tag>
  class IdentityId
  {
  public:
    /**
     * @brief Construct an empty identifier.
     */
    IdentityId() = default;

    /**
     * @brief Construct an identifier from its string representation.
     *
     * @param value Identifier value.
     */
    explicit IdentityId(std::string value)
        : value_(std::move(value))
    {
    }

    /**
     * @brief Construct an identifier from a string view.
     *
     * @param value Identifier value.
     */
    explicit IdentityId(std::string_view value)
        : value_(value)
    {
    }

    /**
     * @brief Return the underlying identifier value.
     *
     * @return Identifier value.
     */
    [[nodiscard]] const std::string &value() const noexcept
    {
      return value_;
    }

    /**
     * @brief Return whether the identifier is empty.
     *
     * @return true when the identifier has no value.
     */
    [[nodiscard]] bool empty() const noexcept
    {
      return value_.empty();
    }

    /**
     * @brief Return whether the identifier is valid.
     *
     * @return true when the identifier is not empty.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return !empty();
    }

    /**
     * @brief Test whether this identifier matches a string value.
     *
     * @param value Identifier value to compare.
     * @return true when the values match.
     */
    [[nodiscard]] bool has_value(std::string_view value) const noexcept
    {
      return value_ == value;
    }

    /**
     * @brief Convert the identifier to a boolean validity state.
     *
     * @return true when the identifier is valid.
     */
    explicit operator bool() const noexcept
    {
      return valid();
    }

    auto operator<=>(const IdentityId &) const = default;

  private:
    std::string value_;
  };

  struct AccountIdTag;
  struct HumanIdTag;
  struct PersonaIdTag;
  struct AuthSessionIdTag;

  /**
   * @brief Unique identifier of an Orelunza account.
   */
  using AccountId = IdentityId<AccountIdTag>;

  /**
   * @brief Unique identifier of a human identity.
   */
  using HumanId = IdentityId<HumanIdTag>;

  /**
   * @brief Unique identifier of a public persona.
   */
  using PersonaId = IdentityId<PersonaIdTag>;

  /**
   * @brief Unique identifier of an authentication session.
   */
  using AuthSessionId = IdentityId<AuthSessionIdTag>;

  /**
   * @brief Hash function for strongly typed identity identifiers.
   *
   * @tparam Tag Identifier tag.
   */
  template <typename Tag>
  struct IdentityIdHash
  {
    [[nodiscard]] std::size_t operator()(
        const IdentityId<Tag> &id) const noexcept
    {
      return std::hash<std::string_view>{}(id.value());
    }
  };
} // namespace orelunza::identity::domain

#endif // ORELUNZA_IDENTITY_DOMAIN_IDENTITY_IDS_HPP_INCLUDED
