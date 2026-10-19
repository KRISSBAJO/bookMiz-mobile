export type BookingPaymentState = {
  status: string;
  paymentStatus?: string;
  refundStatus?: string | null;
  paymentMode?: "test" | "live" | null;
};

export function bookingPaymentLabel(booking: BookingPaymentState) {
  if (booking.refundStatus === "NEEDS_REVIEW" && booking.paymentStatus !== "REFUNDED") return "Refund needs support";
  if (booking.paymentStatus === "REFUNDED") return "Refunded";
  if (booking.paymentStatus === "PAID") {
    return booking.status === "CANCELLED" && (booking.paymentMode || booking.refundStatus)
      ? "Refund pending"
      : "Paid";
  }
  if (booking.paymentStatus === "UNPAID") return "Unpaid";
  return "Payment status unavailable";
}

export function shouldRefreshBookingPayment(booking: BookingPaymentState) {
  return booking.refundStatus !== "NEEDS_REVIEW" && Boolean(booking.paymentMode || booking.refundStatus) && (booking.paymentStatus === "UNPAID"
    && booking.status !== "CANCELLED" || booking.paymentStatus === "PAID"
    && booking.status === "CANCELLED");
}
