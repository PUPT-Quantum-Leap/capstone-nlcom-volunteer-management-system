import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IcsService } from './ics.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { of } from 'rxjs';

const API = `${environment.apiUrl}/ics`;

describe('IcsService (AI suggestions)', () => {
  let service: IcsService;
  let httpMock: HttpTestingController;

  const authServiceMock = {
    ensureCsrf$: () => of(undefined as void),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [IcsService, { provide: AuthService, useValue: authServiceMock }],
    });
    service = TestBed.inject(IcsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('createIcs', () => {
    it('posts to /ics with rsvp_id and name', () => {
      service.createIcs({ rsvp_id: 1, name: 'Test Event' }).subscribe();

      const req = httpMock.expectOne(API);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ rsvp_id: 1, name: 'Test Event' });
      expect(req.request.withCredentials).toBe(true);
      req.flush({ data: { id: 10, rsvp_id: 1, name: 'Test Event' } });
    });
  });

  describe('getAiSuggestions', () => {
    it('gets from /ics/{id}/ai-suggestions', () => {
      service.getAiSuggestions(10).subscribe();

      const req = httpMock.expectOne(`${API}/10/ai-suggestions`);
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ data: [], meta: { message: null, total_volunteers: 0 } });
    });
  });

  describe('applyAiSuggestions', () => {
    it('posts to /ics/{id}/apply-suggestions with suggestions payload', () => {
      const suggestions = [{
        volunteer_id: 5,
        volunteer_name: 'Juan dela Cruz',
        team_id: 1,
        team_name: 'Medical Team',
        role: 'Medical Officer',
        skills: ['First Aid'],
        confidence: 0.92,
      }];
      service.applyAiSuggestions(10, suggestions).subscribe();

      const req = httpMock.expectOne(`${API}/10/apply-suggestions`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ suggestions });
      expect(req.request.withCredentials).toBe(true);
      req.flush({ message: 'AI suggestions applied successfully.' });
    });
  });
});
