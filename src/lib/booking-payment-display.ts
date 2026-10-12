export type BookingPaymentState = {
  status: string;
  paymentStatus?: string;
  paymentMode?: "test" | "live" | null;
};

export function bookingPaymentLabel(booking: BookingPaymentState) {
  if (booking.paymentStatus === "REFUNDED") return "Refunded";
  if (booking.paymentStatus === "PAID") {
    return booking.status === "CANCELLED" && booking.paymentMode
      ? "Refund pending"
      : "Paid";
  }
  if (booking.paymentStatus === "UNPAID") return "Unpaid";
  return "Payment status unavailable";
}

export function shouldRefreshBookingPayment(booking: BookingPaymentState) {
  return Boolean(booking.paymentMode) && (booking.paymentStatus === "UNPAID"
    && booking.status !== "CANCELLED" || booking.paymentStatus === "PAID"
    && booking.status === "CANCELLED");
}
