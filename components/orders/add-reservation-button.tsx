"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReservationFormModal } from "@/components/orders/reservation-form";

export function AddReservationButton() {
  const [open, setOpen] = useState(false);

  const modal = open ? createPortal(
    <ReservationFormModal mode="create" onClose={() => setOpen(false)} />,
    document.body
  ) : null;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Add Reservation
      </Button>
      {modal}
    </>
  );
}
