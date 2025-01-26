-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('Upcoming', 'Completed', 'Cancelled');

-- CreateEnum
CREATE TYPE "RideProvider" AS ENUM ('OLA', 'UBER', 'RAPIDO', 'BLABLACAR', 'MERUCABS');

-- CreateEnum
CREATE TYPE "RideType" AS ENUM ('Local', 'Outstation', 'Airport', 'Rental');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "OlaAccessToken" TEXT NOT NULL,
    "UberAccessToken" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rides" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rideProvider" "RideProvider" NOT NULL,
    "rideType" "RideType" NOT NULL,
    "vechileSelected" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "pickupLocation" TEXT NOT NULL,
    "dropLocation" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "fare" INTEGER NOT NULL,
    "dateAndTime" TIMESTAMP(3) NOT NULL,
    "rideStatus" "RideStatus" NOT NULL DEFAULT 'Upcoming',

    CONSTRAINT "Rides_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Rides" ADD CONSTRAINT "Rides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
