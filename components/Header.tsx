import React from "react";
import { NavBarDemo } from "./subcomponent";
function Header() {
  return (
    <header className="w-full z-20 fixed top-0 left-0 bg-background">
      <NavBarDemo />
    </header>
  );
}

export default Header;
