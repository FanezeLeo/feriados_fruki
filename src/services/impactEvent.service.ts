import { impactEventRepository } from '@repositories/impactEvent.repository';
import { cacheService } from './cache.service';
import { locationService } from './location.service';
import {
  ImpactEvent,
  ImpactEventLocationRangeResult,
  ImpactEventQueryParams,
  Location,
  PaginatedResponse,
} from '@/types';
import { NotFoundError } from '@utils/errors';
import { logger } from '@utils/logger';

type LocationWithDbFields = Location & {
  state_code?: string;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toIsoDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function applicableLocationCodes(location: Location): string[] {
  if (location.type === 'country') return [location.code];
  if (location.type === 'state') return ['BR', location.code];

  const stateCode = location.stateCode ?? (location as LocationWithDbFields).state_code;
  return stateCode ? ['BR', stateCode, location.code] : ['BR', location.code];
}

function normalizeImpactEvent(event: ImpactEvent): ImpactEvent {
  return {
    ...event,
    localDate: toIsoDate(event.localDate),
  };
}

export class ImpactEventService {
  async getImpactEventById(id: string): Promise<ImpactEvent> {
    const event = await impactEventRepository.findImpactEventById(id);

    if (!event) {
      throw new NotFoundError('Impact event not found');
    }

    return normalizeImpactEvent(event);
  }

  async searchImpactEvents(
      params: ImpactEventQueryParams
  ): Promise<PaginatedResponse<ImpactEvent>> {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 100);
    const country = params.country?.toUpperCase() || 'BR';
    const normalizedParams = { ...params, country, page, limit };
    const cacheKey = JSON.stringify(normalizedParams);
    const cached = await cacheService.get<PaginatedResponse<ImpactEvent>>(
        'impact-events',
        cacheKey
    );

    if (cached) {
      logger.debug('Impact events retrieved from cache', { params: normalizedParams });
      return cached;
    }

    const { data, total } = await impactEventRepository.findWithFilters(normalizedParams);
    const totalPages = Math.ceil(total / limit);
    const result = {
      data: data.map(normalizeImpactEvent),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };

    await cacheService.set('impact-events', cacheKey, result, 86400);

    return result;
  }

  async getApplicableImpactEventsByDateRange(
      locationCode: string,
      startDate: string,
      endDate: string
  ): Promise<ImpactEventLocationRangeResult> {
    const location = await locationService.getLocationByCode(locationCode);
    const events = await impactEventRepository.findByLocationCodesAndDateRange(
        applicableLocationCodes(location),
        startDate,
        endDate
    );

    return {
      location,
      events: events.map(normalizeImpactEvent),
    };
  }

  async getNextImpactEvents(limit = 5, country = 'BR'): Promise<ImpactEvent[]> {
    const normalizedCountry = country.toUpperCase();
    const today = todayIsoDate();
    const cacheKey = `${today}-${normalizedCountry}-${limit}`;
    const cached = await cacheService.get<ImpactEvent[]>('impact-events-next', cacheKey);

    if (cached) {
      logger.debug('Next impact events retrieved from cache', { limit, country: normalizedCountry });
      return cached;
    }

    const events = (await impactEventRepository.findNext(today, limit, normalizedCountry))
        .map(normalizeImpactEvent);
    await cacheService.set('impact-events-next', cacheKey, events, 3600);

    return events;
  }
}

export const impactEventService = new ImpactEventService();