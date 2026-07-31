/**
 *
 * @file Persona.hpp
 * @author Softadastra
 * @brief Public persona domain model for the Orelunza identity module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_IDENTITY_DOMAIN_PERSONA_HPP_INCLUDED
#define ORELUNZA_IDENTITY_DOMAIN_PERSONA_HPP_INCLUDED

#include <identity/domain/IdentityIds.hpp>

#include <cstdint>
#include <string>
#include <string_view>
#include <utility>

namespace orelunza::identity::domain
{
  /**
   * @brief Represents a public identity used inside Orelunza.
   *
   * A Persona belongs to a Human and contains only information that may be
   * exposed to other inhabitants of the world.
   */
  class Persona
  {
  public:
    /**
     * @brief Construct an empty persona.
     */
    Persona() = default;

    /**
     * @brief Construct a persona.
     *
     * @param id Persona identifier.
     * @param human_id Owning human identifier.
     * @param display_name Public display name.
     * @param avatar Public avatar reference.
     * @param created_at Creation time in epoch seconds.
     * @param updated_at Last update time in epoch seconds.
     */
    Persona(
        PersonaId id,
        HumanId human_id,
        std::string display_name,
        std::string avatar,
        std::int64_t created_at,
        std::int64_t updated_at)
        : id_(std::move(id)),
          human_id_(std::move(human_id)),
          display_name_(std::move(display_name)),
          avatar_(std::move(avatar)),
          created_at_(created_at),
          updated_at_(updated_at)
    {
    }

    /**
     * @brief Return the persona identifier.
     *
     * @return Persona identifier.
     */
    [[nodiscard]] const PersonaId &id() const noexcept
    {
      return id_;
    }

    /**
     * @brief Return the owning human identifier.
     *
     * @return Human identifier.
     */
    [[nodiscard]] const HumanId &human_id() const noexcept
    {
      return human_id_;
    }

    /**
     * @brief Return the public display name.
     *
     * @return Display name.
     */
    [[nodiscard]] const std::string &display_name() const noexcept
    {
      return display_name_;
    }

    /**
     * @brief Return the public avatar reference.
     *
     * @return Avatar reference.
     */
    [[nodiscard]] const std::string &avatar() const noexcept
    {
      return avatar_;
    }

    /**
     * @brief Return whether the persona has an avatar.
     *
     * @return true when an avatar reference is present.
     */
    [[nodiscard]] bool has_avatar() const noexcept
    {
      return !avatar_.empty();
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
     * @brief Return whether the persona contains valid domain data.
     *
     * An avatar is optional, but a persona must have an identifier, an owning
     * human, and a non-empty display name.
     *
     * @return true when the persona is valid.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return id_.valid() &&
             human_id_.valid() &&
             !display_name_.empty() &&
             created_at_ >= 0 &&
             updated_at_ >= created_at_;
    }

    /**
     * @brief Test whether this persona has the supplied identifier.
     *
     * @param id Persona identifier.
     * @return true when the identifiers match.
     */
    [[nodiscard]] bool has_id(const PersonaId &id) const noexcept
    {
      return id_ == id;
    }

    /**
     * @brief Test whether this persona belongs to a human.
     *
     * @param human_id Human identifier.
     * @return true when the human identifiers match.
     */
    [[nodiscard]] bool belongs_to(
        const HumanId &human_id) const noexcept
    {
      return human_id_ == human_id;
    }

    /**
     * @brief Test whether the persona has the supplied display name.
     *
     * @param display_name Display name to compare.
     * @return true when the display names match.
     */
    [[nodiscard]] bool has_display_name(
        std::string_view display_name) const noexcept
    {
      return display_name_ == display_name;
    }

    /**
     * @brief Change the public display name.
     *
     * @param display_name New display name.
     */
    void set_display_name(std::string display_name)
    {
      display_name_ = std::move(display_name);
    }

    /**
     * @brief Change the public avatar reference.
     *
     * @param avatar New avatar reference.
     */
    void set_avatar(std::string avatar)
    {
      avatar_ = std::move(avatar);
    }

    /**
     * @brief Remove the public avatar reference.
     */
    void clear_avatar()
    {
      avatar_.clear();
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
    PersonaId id_;
    HumanId human_id_;

    std::string display_name_;
    std::string avatar_;

    std::int64_t created_at_ = 0;
    std::int64_t updated_at_ = 0;
  };
} // namespace orelunza::identity::domain

#endif // ORELUNZA_IDENTITY_DOMAIN_PERSONA_HPP_INCLUDED
