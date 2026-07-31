#include <identity/IdentityModule.hpp>
#include <identity/controllers/IdentityController.hpp>

#include <vix.hpp>

namespace orelunza::identity
{
  const char *IdentityModule::name()
  {
    return "identity";
  }

  void IdentityModule::register_routes(vix::App &app)
  {
    controllers::IdentityController::register_routes(app);
  }
} // namespace orelunza::identity
