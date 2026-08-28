import { MessageCircle } from "lucide-react";

/** Bouton WhatsApp flottant — canal de contact privilégié en Guinée. */
export default function WhatsAppFloat() {
  return (
    <a
      href="https://wa.me/224662860976?text=Bonjour%20Bonne%20Humeur%20TV%20!"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Discuter sur WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-guinea-green text-white shadow-[0_8px_30px_-6px_rgba(0,154,68,0.6)] transition-transform hover:scale-110"
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-guinea-green opacity-20" />
      <MessageCircle className="relative h-6 w-6" />
    </a>
  );
}
