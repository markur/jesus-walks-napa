import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export function Hero() {
  return (
    <div className="relative">
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1464823063530-08f10ed1a2dd)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(0.5)'
        }}
      />
      
      <div className="relative z-10 container mx-auto px-4 py-24 sm:py-32">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Find Your Path in Faith & Nature
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-300">
            Join a community of believers who share your passion for outdoor adventure
            and spiritual growth. Experience God's creation through guided hikes and
            meaningful connections with Jesus Walkers.
          </p>
          <div className="mt-10 flex gap-x-6">
            <Link href="/register">
              <Button size="lg" className="text-lg">
                Join Our Community
              </Button>
            </Link>
            <Link href="/events">
              <Button variant="outline" size="lg" className="text-lg text-white border-white hover:bg-white/10">
                View Events
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}