"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import useGenPodcast from "@/hooks/genPodcast";

export default function page() {
  const { genPodcast } = useGenPodcast();

  const handleGeneration = async () => {
    try {
      await genPodcast("Hello, how are you?");
    } catch (error) {
      console.error("Error generating podcast:", error);
    }
  };

  return <Button onClick={handleGeneration}>Click me</Button>;
}
