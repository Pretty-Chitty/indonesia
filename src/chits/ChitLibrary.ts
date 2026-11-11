import { IChitLibrary } from "@pretty-chitty/core";

import { BidTag } from "./BidTag";
import { CapacityMarker } from "./CapacityMarker";
import { City } from "./City";
import { CityCard } from "./CityCard";
import { CityHand } from "./CityHand";
import { CitySupply } from "./CitySupply";
import { Company } from "./Company";
import { Cube } from "./Cube";
import { Deed } from "./Deed";
import { DeliveredGood } from "./DeliveredGood";
import { Disc } from "./Disc";
import { GoodsDisplay } from "./GoodsDisplay";
import { GoodsMarker } from "./GoodsMarker";
import { LandArea } from "./LandArea";
import { MainBoard } from "./MainBoard";
import { Market } from "./Market";
import { MergerRow } from "./MergerRow";
import { MergerTable } from "./MergerTable";
import { MoneyMat } from "./MoneyMat";
import { Player } from "./Player";
import { PlayerAid } from "./PlayerAid";
import { Root } from "./Root";
import { SeaArea } from "./SeaArea";
import { Ship } from "./Ship";
import { CashSpark } from "./Sparks";
import { BankSpark } from "./Sparks";
import { EarningsSpark } from "./Sparks";
import { ResearchSpark } from "./Sparks";
import { StartMarker } from "./StartMarker";
import { DeedStore } from "./Stores";
import { CityCardStore } from "./Stores";
import { SupplyRing } from "./SupplyRing";
import { TableCell } from "./TableCell";
import { Tracks } from "./Tracks";

export const ChitLibrary: IChitLibrary<Player, Root> = {
  BidTag,
  CapacityMarker,
  City,
  CityCard,
  CityHand,
  CitySupply,
  Company,
  Cube,
  Deed,
  DeliveredGood,
  Disc,
  GoodsDisplay,
  GoodsMarker,
  LandArea,
  MainBoard,
  Market,
  MergerRow,
  MergerTable,
  MoneyMat,
  Player,
  PlayerAid,
  Root,
  SeaArea,
  Ship,
  CashSpark,
  BankSpark,
  EarningsSpark,
  ResearchSpark,
  StartMarker,
  DeedStore,
  CityCardStore,
  SupplyRing,
  TableCell,
  Tracks,
};
