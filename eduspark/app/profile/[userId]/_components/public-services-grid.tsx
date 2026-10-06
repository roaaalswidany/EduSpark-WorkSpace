import Image from "next/image";
import Link from "next/link";
import { Clock, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface PublicService {
  id: string;
  title: string;
  slug: string;
  thumbnail: string | null;
  price: number;
  deliveryDays: number;
  _count: { orders: number };
}

const GRADIENTS = [
  "from-violet-600 to-indigo-700",
  "from-rose-600 to-pink-700",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-700",
  "from-sky-500 to-blue-700",
  "from-fuchsia-600 to-purple-700",
] as const;

function getGradient(id: string): string {
  const code = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[code % GRADIENTS.length];
}

export function PublicServicesGrid({ services }: { services: PublicService[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {services.map((service) => (
        <Link
          key={service.id}
          href={`/marketplace/services/${service.slug}`}
          className="group rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5"
        >
          <div
            className={cn(
              "relative aspect-video bg-linear-to-br overflow-hidden",
              !service.thumbnail && getGradient(service.id)
            )}
          >
            {service.thumbnail ? (
              <Image
                src={service.thumbnail}
                alt={service.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="font-black text-white/20 select-none"
                  style={{ fontSize: "clamp(2rem, 6vw, 4rem)" }}
                >
                  {service.title.charAt(0)}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col flex-1 p-4 gap-3">
            <h3 className="text-sm font-semibold text-slate-200 line-clamp-2 leading-snug group-hover:text-white transition-colors flex-1">
              {service.title}
            </h3>

            <div className="flex items-end justify-between pt-2.5 border-t border-slate-800">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                <Clock className="w-3 h-3" />
                <span>{service.deliveryDays}d</span>
                {service._count.orders > 0 && (
                  <span className="flex items-center gap-0.5 ml-2">
                    <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                    <span className="text-slate-500 font-medium">
                      {service._count.orders}
                    </span>
                  </span>
                )}
              </div>
              <div className="text-right">
                <p className="text-[9px] font-medium text-slate-600 uppercase tracking-wider">
                  From
                </p>
                <p className="text-base font-black text-white leading-none tabular-nums">
                  $
                  {service.price % 1 === 0
                    ? service.price
                    : service.price.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}