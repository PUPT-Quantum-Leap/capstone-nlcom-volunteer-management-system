  // Populate operational columns from returned ICS data with actual volunteer assignments
  private populateFromIcsData(ics: any): void {
    if (!ics || !ics.volunteers) {
      return;
    }

    // Group volunteers by assigned team_id
    const volunteersByTeam = new Map<number, any[]>();
    ics.volunteers.forEach((volunteer: any) => {
      const teamId = volunteer.pivot?.team_id;
      if (teamId) {
        if (!volunteersByTeam.has(teamId)) {
          volunteersByTeam.set(teamId, []);
        }
        volunteersByTeam.get(teamId)!.push({
          name: volunteer.name,
          isNew: false,
          isDriver: false,
          isLeader: volunteer.pivot.role === 'Leader',
          skills: volunteer.skills?.map((s: any) => s.name) || [],
          training: [],
          department: volunteer.department || '',
          rationale: '',
          alternatives: [],
        });
      }
    });

    // Find team mappings
    const teamMap = new Map<number, string>();
    if (ics.teams) {
      ics.teams.forEach((team: any) => {
        teamMap.set(team.id, team.name);
      });
    }

    // Clear current assignments and repopulate with actual data
    this.mobileKitchen.teams.forEach(team => (team.volunteers = []));
    this.amDistribution.teams.forEach(team => (team.volunteers = []));
    this.pmDistribution.teams.forEach(team => (team.volunteers = []));

    // Assign volunteers to operational columns based on team names
    volunteersByTeam.forEach((volunteers, teamId) => {
      const teamName = teamMap.get(teamId) || '';
      
      // Try to match team to operational columns
      const allTeams = [
        ...this.mobileKitchen.teams,
        ...this.amDistribution.teams,
        ...this.pmDistribution.teams,
      ];

      const matchingTeam = allTeams.find(t => 
        t.name.toLowerCase().includes(teamName.toLowerCase()) ||
        teamName.toLowerCase().includes(t.name.toLowerCase())
      );

      if (matchingTeam) {
        matchingTeam.volunteers = volunteers;
      }
    });

    console.log('Populated operational columns from AI suggestions');
  }