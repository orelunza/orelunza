#include <identity/controllers/IdentityController.hpp>

#include <vix.hpp>

namespace orelunza::identity::controllers
{
  void IdentityController::register_routes(vix::App &app)
  {
    app.get("/api/identity", [](vix::Request &req, vix::Response &res)
    {
      (void)req;

      res.json({
        "ok", true,
        "module", "identity",
        "message", "Identity module is available"
      });
    });
  }
} // namespace orelunza::identity::controllers
