import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IcsService } from './ics.service';
import { Ics, CreateIcsRequest, UpdateIcsRequest, AiSuggestion, AssignVolunteerRequest } from '../models/ics';
import { environment } from '../../environments/environment';

class MockAuthService {
  ensureCsrf$() {
    return { pipe: () => ({ subscribe: (fn: () => void) => fn() }) };
  }
}

describe('IcsService', () => {
  let service: IcsService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl + '/ics';

  const mockIcs: Ics = {
    id: 1,
    rsvp_id: 1,
    rsvp: {
      id: 1,
      title: 'Test Event',
      date: '2024-01-01',
    },
    name: 'Test ICS',
    description: 'Test Description',
    date: '2024-01-01',
    location: 'Test Location',
    status: 'draft',
    ai_suggestions: null,
    teams: null,
    volunteers: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        IcsService,
        { provide: 'AuthService', useClass: MockAuthService },
      ],
    });
    service = TestBed.inject(IcsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getIcs', () => {
    it('should return list of ICS entries wrapped in data envelope', () => {
      const mockResponse = { data: [mockIcs] };

      service.getIcs().subscribe((response) => {
        expect(response).toEqual(mockResponse);
        expect(response.data).toHaveLength(1);
        expect(response.data[0].id).toBe(1);
      });

      const req = httpMock.expectOne(apiUrl);
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      req.flush(mockResponse);
    });
  });

  describe('getIcsById', () => {
    it('should return single ICS wrapped in data envelope', () => {
      const mockResponse = { data: mockIcs };

      service.getIcsById(1).subscribe((response) => {
        expect(response).toEqual(mockResponse);
        expect(response.data.id).toBe(1);
        expect(response.data.name).toBe('Test ICS');
      });

      const req = httpMock.expectOne(`${apiUrl}/1`);
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      req.flush(mockResponse);
    });
  });

  describe('createIcs', () => {
    it('should create ICS and return data envelope', () => {
      const createRequest: CreateIcsRequest = {
        rsvp_id: 1,
        name: 'New ICS',
        description: 'New Description',
        location: 'New Location',
        status: 'draft',
      };
      const mockResponse = { data: { ...mockIcs, ...createRequest } };

      service.createIcs(createRequest).subscribe((response) => {
        expect(response).toEqual(mockResponse);
        expect(response.data.name).toBe('New ICS');
      });

      const req = httpMock.expectOne(apiUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createRequest);
      expect(req.request.withCredentials).toBe(true);
      req.flush(mockResponse);
    });
  });

  describe('updateIcs', () => {
    it('should update ICS and return data envelope', () => {
      const updateRequest: UpdateIcsRequest = {
        name: 'Updated ICS',
        status: 'active',
      };
      const mockResponse = { data: { ...mockIcs, ...updateRequest } };

      service.updateIcs(1, updateRequest).subscribe((response) => {
        expect(response).toEqual(mockResponse);
        expect(response.data.name).toBe('Updated ICS');
        expect(response.data.status).toBe('active');
      });

      const req = httpMock.expectOne(`${apiUrl}/1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateRequest);
      expect(req.request.withCredentials).toBe(true);
      req.flush(mockResponse);
    });
  });

  describe('deleteIcs', () => {
    it('should delete ICS and return message', () => {
      const mockResponse = { message: 'ICS deleted successfully.' };

      service.deleteIcs(1).subscribe((response) => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne(`${apiUrl}/1`);
      expect(req.request.method).toBe('DELETE');
      expect(req.request.withCredentials).toBe(true);
      req.flush(mockResponse);
    });
  });

  describe('getRsvpVolunteers', () => {
    it('should return RSVP volunteers wrapped in data envelope', () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            first_name: 'John',
            last_name: 'Doe',
            full_name: 'John Doe',
            skills: [{ id: 1, name: 'Cooking' }],
            positions: null,
            experiences: null,
          },
        ],
      };

      service.getRsvpVolunteers(1).subscribe((response) => {
        expect(response).toEqual(mockResponse);
        expect(response.data).toHaveLength(1);
        expect(response.data[0].first_name).toBe('John');
      });

      const req = httpMock.expectOne(`${apiUrl}/1/rsvp-volunteers`);
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      req.flush(mockResponse);
    });
  });

  describe('getAiSuggestions', () => {
    it('should return AI suggestions wrapped in data envelope', () => {
      const mockAiSuggestions: AiSuggestion[] = [
        {
          volunteer_id: 1,
          volunteer_name: 'John Doe',
          team_id: 1,
          team_name: 'Kitchen Team',
          role: 'Cook',
          skills: ['Cooking', 'Food Prep'],
          confidence: 0.95,
        },
      ];
      const mockResponse = { data: mockAiSuggestions };

      service.getAiSuggestions(1).subscribe((response) => {
        expect(response).toEqual(mockResponse);
        expect(response.data).toHaveLength(1);
        expect(response.data[0].volunteer_name).toBe('John Doe');
        expect(response.data[0].confidence).toBe(0.95);
      });

      const req = httpMock.expectOne(`${apiUrl}/1/ai-suggestions`);
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      req.flush(mockResponse);
    });
  });

  describe('applyAiSuggestions', () => {
    it('should apply AI suggestions and return message', () => {
      const suggestions: AiSuggestion[] = [
        {
          volunteer_id: 1,
          volunteer_name: 'John Doe',
          team_id: 1,
          team_name: 'Kitchen Team',
          role: 'Cook',
          skills: ['Cooking'],
          confidence: 0.95,
        },
      ];
      const mockResponse = { message: 'AI suggestions applied successfully.' };

      service.applyAiSuggestions(1, suggestions).subscribe((response) => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne(`${apiUrl}/1/apply-suggestions`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ suggestions });
      expect(req.request.withCredentials).toBe(true);
      req.flush(mockResponse);
    });
  });

  describe('assignVolunteer', () => {
    it('should assign volunteer and return message', () => {
      const request: AssignVolunteerRequest = {
        volunteer_id: 1,
        team_id: 1,
        role: 'Cook',
      };
      const mockResponse = { message: 'Volunteer assigned successfully.' };

      service.assignVolunteer(1, request).subscribe((response) => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne(`${apiUrl}/1/assign-volunteer`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      expect(req.request.withCredentials).toBe(true);
      req.flush(mockResponse);
    });
  });

  describe('removeVolunteer', () => {
    it('should remove volunteer and return message', () => {
      const mockResponse = { message: 'Volunteer removed successfully.' };

      service.removeVolunteer(1, 1).subscribe((response) => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne(`${apiUrl}/1/remove-volunteer`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ volunteer_id: 1 });
      expect(req.request.withCredentials).toBe(true);
      req.flush(mockResponse);
    });
  });
});
