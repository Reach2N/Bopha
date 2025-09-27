"use client";
import { Home, FileText, Library, User } from "lucide-react";
import { NavBar } from "@/components/ui/tubelight-navbar";

export function NavBarDemo() {
  const navItems = [
    { name: "Home", url: "/", icon: Home },
    { name: "Voice Agent", url: "/v2v", icon: User },
    { name: "Podcast", url: "/t2v", icon: Library },
    { name: "Resources", url: "/resources", icon: FileText },
  ];

  return <NavBar items={navItems} />;
}
