/**
 * @file HttpResponses.cpp
 * @brief JSON response helper implementation for the orelunza backend.
 */

#include <orelunza/support/HttpResponses.hpp>

namespace orelunza::support
{
  void json_error(
      vix::Response &res,
      int status,
      const std::string &code,
      const std::string &message)
  {
    res.status(status).json({
      "ok", false,
      "error", code,
      "message", message
    });
  }

  void json_ok(
      vix::Response &res,
      const vix::json::Json &data)
  {
    res.json({
      "ok", true,
      "data", data
    });
  }

  void json_message(
      vix::Response &res,
      const std::string &message)
  {
    res.json({
      "ok", true,
      "message", message
    });
  }
} // namespace orelunza::support
