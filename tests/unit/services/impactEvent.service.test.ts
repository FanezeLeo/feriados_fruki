import { impactEventService } from '../../../src/services/impactEvent.service';
import { impactEventRepository } from '../../../src/repositories/impactEvent.repository';
import { cacheService } from '../../../src/services/cache.service';
import { locationService } from '../../../src/services/location.service';

jest.mock('../../../src/repositories/impactEvent.repository');
jest.mock('../../../src/services/cache.service');
jest.mock('../../../src/services/location.service');

describe('ImpactEventService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (cacheService.get as jest.Mock).mockResolvedValue(null);
    (cacheService.set as jest.Mock).mockResolvedValue(undefined);
  });

  it('searches impact events with normalized defaults and pagination', async () => {
    (impactEventRepository.findWithFilters as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'event-1',
          slug: 'copa-2026-brasil-marrocos',
          name: 'Copa 2026: Brasil x Marrocos',
          startsAt: new Date('2026-06-13T22:00:00.000Z'),
          localDate: '2026-06-13',
          year: 2026,
          category: 'sports',
          impactLevel: 'high',
          impactScope: 'national',
          impactType: 'work_schedule_disruption',
          countryCode: 'BR',
          timezone: 'America/Sao_Paulo',
          isHoliday: false,
          status: 'scheduled',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 1,
    });

    const result = await impactEventService.searchImpactEvents({
      year: 2026,
      category: 'sports',
      impactLevel: 'high',
    });

    expect(impactEventRepository.findWithFilters).toHaveBeenCalledWith({
      year: 2026,
      category: 'sports',
      impactLevel: 'high',
      country: 'BR',
      page: 1,
      limit: 50,
    });
    expect(result.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 1,
      totalPages: 1,
    });
    expect(result.data[0].isHoliday).toBe(false);
  });

  it('returns cached search results when available', async () => {
    const cached = {
      data: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
      },
    };
    (cacheService.get as jest.Mock).mockResolvedValue(cached);

    const result = await impactEventService.searchImpactEvents({ year: 2026 });

    expect(result).toBe(cached);
    expect(impactEventRepository.findWithFilters).not.toHaveBeenCalled();
  });

  it('returns next impact events by country', async () => {
    (impactEventRepository.findNext as jest.Mock).mockResolvedValue([]);

    await impactEventService.getNextImpactEvents(3, 'br');

    expect(impactEventRepository.findNext).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      3,
      'BR',
    );
  });

  it('returns applicable impact events for a municipality date range', async () => {
    (locationService.getLocationByCode as jest.Mock).mockResolvedValue({
      id: 'loc-sao-paulo',
      type: 'municipality',
      code: 'SP-SAO-PAULO',
      name: 'São Paulo',
      state_code: 'SP',
    });
    (impactEventRepository.findByLocationCodesAndDateRange as jest.Mock).mockResolvedValue([
      {
        id: 'event-1',
        slug: 'copa-2026-brasil-marrocos',
        name: 'Copa 2026: Brasil x Marrocos',
        startsAt: new Date('2026-06-13T22:00:00.000Z'),
        localDate: '2026-06-13',
        year: 2026,
        category: 'sports',
        impactLevel: 'high',
        impactScope: 'national',
        impactType: 'work_schedule_disruption',
        countryCode: 'BR',
        timezone: 'America/Sao_Paulo',
        isHoliday: false,
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await impactEventService.getApplicableImpactEventsByDateRange(
      'sp-sao-paulo',
      '2026-01-01',
      '2026-12-31',
    );

    expect(locationService.getLocationByCode).toHaveBeenCalledWith('sp-sao-paulo');
    expect(impactEventRepository.findByLocationCodesAndDateRange).toHaveBeenCalledWith(
      ['BR', 'SP', 'SP-SAO-PAULO'],
      '2026-01-01',
      '2026-12-31',
    );
    expect(result.location.code).toBe('SP-SAO-PAULO');
    expect(result.events).toHaveLength(1);
    expect(result.events[0].localDate).toBe('2026-06-13');
  });
});
